import App from '../app'
import { cacheGet, cacheSet } from '../config/redis'
import { ModelParams } from '../core/Model'
import { User } from '../users/User'
import Rule, { RuleTree } from './Rule'
import { check } from './RuleEngine'

export type RuleWithEvaluationResult = Omit<Rule, ModelParams | 'equals'> & { result?: boolean }

export type RuleResults = { success: string[], failure: string[] }

const CacheKeys = {
    ruleTree: (rootId: number) => `rule_tree:${rootId}`,
}

/**
 * For a given user and set of rules joined with evaluation results,
 * check if all rules are true.
 *
 * This is the fastest option available for checking a rule set since it
 * uses cached values.
 */
export const checkRules = (user: User, root: Rule | RuleTree, rules: RuleWithEvaluationResult[]) => {
    const predicate = (rule: RuleWithEvaluationResult) => {
        return rule.group === 'user'
            ? check({ user: user.flatten(), events: [] }, rule as Rule)
            : rule.result ?? false
    }
    if (root.operator === 'or') return rules.some(predicate)
    if (root.operator === 'none') return !rules.some(predicate)
    if (root.operator === 'xor') return rules.filter(predicate).length === 1
    return rules.every(predicate)
}

/**
 * For a given root ID value of a rule set, find all children and compile
 * into a nested tree structure.
 */
export const fetchAndCompileRule = async (rootId: number): Promise<RuleTree> => {

    const cache = await cacheGet<RuleTree>(App.main.redis, CacheKeys.ruleTree(rootId))
    if (cache) return cache

    const root = await Rule.find(rootId)
    if (!root) throw new Error(`Rule with ID ${rootId} not found`)

    const rules = await Rule.all(qb => qb.where('root_uuid', root!.uuid))
    const compiled = compileRule(root, rules)
    await cacheSet(App.main.redis, CacheKeys.ruleTree(rootId), compiled, 3600)
    return compiled
}

export const compileRule = (root: Rule, rules: Rule[]): RuleTree => {
    const build = ({ uuid, project_id, created_at, updated_at, ...rest }: Rule): RuleTree => {
        const children = rules.filter(rule => rule.parent_uuid === uuid)
        return {
            ...rest,
            uuid,
            children: children.map(build),
        }
    }

    return build(root)
}
