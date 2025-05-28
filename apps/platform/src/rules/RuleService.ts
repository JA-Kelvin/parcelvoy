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
 * For a provided root rule UUID of a set, fetch the associated rules
 * and check if the entire rule set is true.
 *
 * This uses cached result values for evaluations.
 */
export const checkRootRule = async (uuid: string, user: User) => {
    const [root, ...rules] = await Rule.all(qb => qb
        .leftJoin('rule_evaluations', function() {
            this.on('rule_evaluations.rule_id', 'rules.id')
                .andOn('rule_evaluations.user_id', Rule.raw(user.id))
        })
        .where('parent_uuid', uuid)
        .orWhere('uuid', uuid)
        .select('rules.*', 'result'),
    ) as Array<Rule & { result?: boolean }>
    return checkRules(user, root, rules)
}

export const matchingRulesForUser = async (user: User): Promise<RuleResults> => {
    const rules = await Rule.all(qb =>
        qb.where('rules.group', 'parent')
            .where('rules.type', 'wrapper')
            .where('project_id', user.project_id),
    )

    const success = []
    const failure = []
    for (const rule of rules) {
        const result = await checkRootRule(rule.uuid, user)
        result
            ? success.push(rule.uuid)
            : failure.push(rule.uuid)
    }
    return { success, failure }
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
