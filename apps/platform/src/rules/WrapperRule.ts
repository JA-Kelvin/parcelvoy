import { numComp } from './NumberRule'
import { EventRuleFrequency, EventRulePeriod, EventRuleTree, RuleTree } from './Rule'
import { RuleCheck, RuleCheckParams, RuleEvalException, RuleQueryParams } from './RuleEngine'
import { dateFromPeriod, isEventWrapper, whereQuery } from './RuleHelpers'

const checkWrapper = ({ input, registry, rule, value }: RuleCheckParams) => {

    const predicate = (child: RuleTree) => registry.get(child.type)?.check({ input, registry, rule: child, value })

    if (!rule.children) return true

    if (rule.operator === 'or') {
        return rule.children.some(predicate)
    }

    if (rule.operator === 'and') {
        return rule.children.every(predicate)
    }

    throw new RuleEvalException(rule, 'unknown operator: ' + rule.operator)
}

const periodQuery = (period: EventRulePeriod) => {
    if (period.type === 'rolling') {
        return `created_at >= now() - INTERVAL ${period.value} ${period.unit}`
    } else if (period.type === 'fixed') {
        const start = new Date(period.start_date)
        if (!period.end_date) {
            return `created_at >= '${start.toISOString()}'`
        }
        const end = new Date(period.end_date)
        return `(created_at >= '${start.toISOString()}' AND created_at <= '${end.toISOString()}')`
    }
    return undefined
}

const frequencyQuery = (frequency?: EventRuleFrequency) => {
    const count = frequency?.count ?? 1
    const operator = frequency?.operator ?? '>='
    return whereQuery('count()', operator, count)
}

// Build a WHERE predicate string for event-scope children, flattening nested event-group wrappers
const buildEventWhere = (child: RuleTree, registry: RuleQueryParams['registry'], projectId: number): string => {
    // Nested event wrapper with its own name/frequency is not supported within another event wrapper
    if (isEventWrapper(child)) {
        throw new RuleEvalException(child, 'nested event wrappers with name/frequency are not supported inside another event wrapper')
    }

    if (child.type === 'wrapper') {
        const op = child.operator
        if (op !== 'and' && op !== 'or') {
            throw new RuleEvalException(child, 'unknown operator: ' + child.operator)
        }
        const sub = (child.children ?? [])
            .map(c => buildEventWhere(c, registry, projectId))
            .filter(Boolean)
            .join(` ${op} `)
        return sub ? `(${sub})` : ''
    }

    // Leaf event rule → predicate fragment
    return registry.get(child.type)?.query({ registry, rule: child, projectId })
}

const eventWrapperQuery = ({ rule, registry, projectId }: RuleQueryParams & { rule: EventRuleTree }) => {
    const children = rule.children ?? []
    const operator = rule.operator
    if (operator !== 'and' && operator !== 'or') {
        throw new RuleEvalException(rule, 'unknown operator: ' + rule.operator)
    }

    const filters = children
        .map(child => buildEventWhere(child, registry, projectId))
        .filter(Boolean)
        .join(` ${operator} `)

    const where = [
        `project_id = ${projectId}`,
        whereQuery('name', '=', rule.value),
    ]
    if (filters) where.push(`(${filters})`)
    if (rule.frequency?.period) {
        const query = periodQuery(rule.frequency.period)
        if (query) where.push(query)
    }

    return `
        SELECT user_id AS id 
        FROM user_events 
        WHERE ${where.join(' and ')}
        GROUP BY project_id, user_id
        HAVING ${frequencyQuery(rule.frequency)}`
}

export default {
    check(params) {
        if (isEventWrapper(params.rule)) {
            if (!params.rule.value) return false
            const { operator = '>=', count = 1, period } = params.rule.frequency ?? {}

            let checkCount = 0
            for (const event of params.input.events) {

                // If names don't match, skip
                if (event.name !== params.rule.value) continue

                // If event is outside of the rule period, skip
                if (period) {
                    const { start_date } = dateFromPeriod(period)
                    if (event.created_at < start_date) continue
                }

                // If wrapper evaluates as true, increment checkCount
                if (checkWrapper({ ...params, value: event })) {
                    checkCount++

                    // Determine if we can bail early (only when checking
                    // for a minimum count otherwise need to check all)
                    if (numComp(checkCount, operator, count) && !['<', '<='].includes(operator)) {
                        return true
                    }
                }
            }
            return numComp(checkCount, operator, count)
        }
        return checkWrapper(params)
    },
    query({ rule, registry, projectId }) {
        const operator = rule.operator
        if (operator !== 'and' && operator !== 'or') {
            throw new RuleEvalException(rule, 'unknown operator: ' + rule.operator)
        }

        // Need to wrap the query to get latest version of data
        const baseQuery = 'SELECT id FROM users FINAL'

        const children = rule.children ?? []
        if (isEventWrapper(rule)) {
            return eventWrapperQuery({ rule, registry, projectId })
        } else if (!children.length) {
            return baseQuery + ' WHERE project_id = ' + projectId
        }

        const parentOperator = rule.operator === 'and' ? 'INTERSECT' : 'UNION DISTINCT'
        const userRules = children.filter(child => child.group === 'user')
        const eventRules = children.filter(child => child.group === 'event')

        const queries: string[] = []

        // Split user rules into predicate leaves and nested user wrappers
        const userPredicateRules = userRules.filter(child => child.type !== 'wrapper')
        const userWrapperRules = userRules.filter(child => child.type === 'wrapper')

        if (userPredicateRules.length) {
            const predicates = userPredicateRules
                .map(child => registry.get(child.type)?.query({ registry, rule: child, projectId }))
                .join(` ${operator} `)
            const userQuery = `${baseQuery} PREWHERE ${predicates} WHERE project_id = ${projectId}`
            queries.push(userQuery)
        }

        // Compose nested user wrapper subqueries
        for (const child of userWrapperRules) {
            const sub = registry.get(child.type)?.query({ registry, rule: child, projectId })
            if (sub) queries.push(sub)
        }

        // Event rules must be wrappers at this level; primitives are not supported here
        for (const child of eventRules) {
            if (child.type !== 'wrapper') {
                throw new RuleEvalException(child, 'event rules at parent level must be wrappers (event conditions)')
            }
            const sub = registry.get(child.type)?.query({ registry, rule: child, projectId })
            if (sub) queries.push(sub)
        }

        if (!queries.length) {
            return baseQuery + ' WHERE project_id = ' + projectId
        }
        if (queries.length === 1) return queries[0]
        return queries.join(` ${parentOperator} `)
    },
} satisfies RuleCheck
