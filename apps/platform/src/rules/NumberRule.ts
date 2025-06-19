import { RuleCheck, RuleEvalException } from './RuleEngine'
import { compile, queryPath, queryValue as queryValues, whereQuery, whereQueryNullable } from './RuleHelpers'

export default {
    check({ rule, value }) {
        const values = queryValues(value, rule, item => Number(item))

        if (rule.operator === 'is set') {
            return values.length > 0
        }

        if (rule.operator === 'is not set') {
            return values.length === 0
        }

        const ruleValue = compile(rule, item => Number(item))

        return values.some(v => {
            switch (rule.operator) {
            case '=':
                return v === ruleValue
            case '!=':
                return v !== ruleValue
            case '<':
                return v < ruleValue
            case '>':
                return v > ruleValue
            case '<=':
                return v <= ruleValue
            case '>=':
                return v >= ruleValue
            default:
                throw new RuleEvalException(rule, 'unknown operator: ' + rule.operator)
            }
        })
    },

    query({ rule }) {
        const path = queryPath(rule)

        if (rule.operator === 'is set') {
            return whereQueryNullable(path, false)
        }

        if (rule.operator === 'is not set') {
            return whereQueryNullable(path, true)
        }

        const ruleValue = compile(rule, item => Number(item))

        if (['=', '!=', '<', '<=', '>', '>=', 'any', 'none'].includes(rule.operator)) {
            return whereQuery(path, rule.operator, ruleValue)
        }

        throw new RuleEvalException(rule, 'unknown operator: ' + rule.operator)
    },
} satisfies RuleCheck
