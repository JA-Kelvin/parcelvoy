// Array normalization utilities for Enhanced MJML Editor
// - toArray: coerces numeric-keyed plain objects into arrays
// - normalizeArrayShapes: recursively converts any numeric-keyed objects into arrays

export const toArray = <T = any>(val: any): T[] => {
    if (Array.isArray(val)) return val
    if (val && typeof val === 'object') {
        const keys = Object.keys(val).filter(k => String(Number(k)) === k)
        if (keys.length) {
            return keys.sort((a, b) => Number(a) - Number(b)).map(k => val[k])
        }
    }
    return []
}

export const normalizeArrayShapes = (value: any): any => {
    if (Array.isArray(value)) return value.map(normalizeArrayShapes)
    if (value && typeof value === 'object') {
        const keys = Object.keys(value)
        const numericKeys = keys.filter(k => String(Number(k)) === k)
        if (numericKeys.length && numericKeys.length === keys.length) {
            return numericKeys
                .sort((a, b) => Number(a) - Number(b))
                .map(k => normalizeArrayShapes(value[k]))
        }
        const out: Record<string, any> = {}
        for (const k of keys) out[k] = normalizeArrayShapes(value[k])
        return out
    }
    return value
}
