import jsonpath from 'jsonpath'
import { AnyJson, Operator, RuleGroup, RuleTree } from './Rule'
import { compileTemplate } from '../render'
import { visit } from '../utilities'

export const queryValue = <T>(
    value: Record<string, unknown>,
    rule: RuleTree,
    cast: (item: any) => T = v => v,
): T[] => {
    let path = rule.path
    if (!value || !path) return []
    if (!path.startsWith('$.') && !path.startsWith('$[')) path = '$.' + path
    return jsonpath.query(value, path).map(v => cast(v))
}

const formattedQueryValue = (value: any) => typeof value === 'string' ? `'${value}'` : value

export const queryPath = (rule: RuleTree): string => {
    const column = rule.path.replace('$.', '')
    if (reservedPaths[rule.group].includes(column)) {
        return column
    }
    const parts = column.split('.')
    return `\`data\`.\`${parts.join('`.`')}\``
}

export const whereQuery = <T extends AnyJson | undefined>(path: string, operator: Operator, value: T, type?: string): string => {

    if (type) path = `CAST(${path}, '${type}')`
    if (Array.isArray(value)) {
        const parts = value.map(formattedQueryValue).join(',')

        if (operator === 'any') {
            return `${path} IN (${parts})`
        } else if (operator === 'none') {
            return `${path} NOT IN (${parts})`
        }
    }

    if (operator === 'contains') return `${path} LIKE '%${value}%'`
    if (operator === 'starts with') return `${path} LIKE '${value}%'`
    if (operator === 'not start with') return `${path} NOT LIKE '${value}%'`

    return `${path} ${operator} ${formattedQueryValue(value)}`
}

export const whereQueryNullable = (path: string, isNull: boolean): string => {
    return `${path} ${isNull ? 'IS NULL' : 'IS NOT NULL'}`
}

// TODO: rule tree "compile step"... we shouldn't do this once per user
// it would be nice if JSON path also supported a parsed/compiled intermediate format too
export const compile = <Y>(rule: RuleTree, cast: (item: AnyJson) => Y): Y => {
    let value = rule.value as AnyJson
    if (typeof value === 'string' && value.includes('{')) {
        value = compileTemplate(value)({})
    }
    return cast(value)
}

export const reservedPaths: Record<RuleGroup, string[]> = {
    user: [
        'external_id',
        'email',
        'phone',
        'timezone',
        'locale',
        'created_at',
    ],
    event: [
        'name',
        'created_at',
    ],
    parent: [],
}

export const isEventWrapper = (rule: RuleTree) => {
    return rule.group === 'event'
        && (rule.path === '$.name' || rule.path === 'name')
}

export const getRuleEventNames = (rule: RuleTree) => {
    const names: string[] = []
    visit(rule, r => r.children, r => {
        if (isEventWrapper(r)) {
            const name = r.value
            if (typeof name === 'string' && !names.includes(name)) {
                names.push(name)
            }
        }
    })
    return names
}
