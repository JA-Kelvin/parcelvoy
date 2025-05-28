import { RuleTree } from './Rule'
import { RuleCheck, RuleCheckParams, RuleEvalException } from './RuleEngine'
import { isEventWrapper, whereQuery } from './RuleHelpers'

const checkWrapper = ({ input, registry, rule, value }: RuleCheckParams) => {

    const predicate = (child: RuleTree) => registry.get(child.type)?.check({ input, registry, rule: child, value })

    if (!rule.children) return true

    if (rule.operator === 'or') {
        return rule.children.some(predicate)
    }

    if (rule.operator === 'and') {
        return rule.children.every(predicate)
    }

    if (rule.operator === 'none') {
        return !rule.children.some(predicate)
    }

    if (rule.operator === 'xor') {
        return rule.children.filter(predicate).length === 1
    }

    throw new RuleEvalException(rule, 'unknown operator: ' + rule.operator)
}

export default {
    check(params) {
        if (isEventWrapper(params.rule)) {
            if (!params.rule.value) return false
            return params.input.events.some(event => {
                if (event.name !== params.rule.value) {
                    return false
                }
                return checkWrapper({ ...params, value: event })
            })
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

        const children = rule.children
        if (!children) return baseQuery + ' WHERE project_id = ' + projectId

        if (isEventWrapper(rule)) {
            return `SELECT DISTINCT user_id AS id FROM user_events WHERE project_id = ${projectId} AND `
                + [
                    whereQuery('name', '=', rule.value),
                    ...children
                        .map(child => registry
                            .get(child.type)
                            ?.query({ registry, rule: child, projectId }),
                        ),
                ].join(` ${operator} `)
        }

        const parentOperator = rule.operator === 'and' ? 'INTERSECT' : 'UNION DISTINCT'
        const userRules = children.filter(child => child.group === 'user')
        const eventRules = children.filter(child => child.group === 'event')

        const queries = []
        if (userRules.length) {
            const userQuery = `${baseQuery} PREWHERE `
                + userRules
                    .map(child => registry.get(child.type)?.query({ registry, rule: child, projectId }))
                    .join(` ${operator} `)
                + ` WHERE project_id = ${projectId}`
            queries.push(userQuery)
        }

        if (eventRules.length) {
            const eventQuery = ''
                + eventRules
                    .map(child => registry.get(child.type)?.query({ registry, rule: child, projectId }))
                    .join(` ${parentOperator} `)
            queries.push(eventQuery)
        }

        return queries.join(` ${parentOperator} `)
    },
} satisfies RuleCheck
