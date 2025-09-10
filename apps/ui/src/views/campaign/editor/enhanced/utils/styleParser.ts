// Style Parser for Enhanced MJML Editor
// Parses mj-style CSS and mj-attributes for canvas edit mode application
import { EditorElement } from '../types'

export interface ParsedStyles {
    globalCss: string
    globalAttributes: Record<string, Record<string, string>>
    cssRules: CSSRule[]
}

export interface CSSRule {
    selector: string
    properties: Record<string, string>
    specificity: number
}

// Parse CSS text into structured rules
export const parseCssRules = (cssText: string): CSSRule[] => {
    const rules: CSSRule[] = []
    if (!cssText?.trim()) return rules

    try {
        // Create a temporary style element to parse CSS
        const style = document.createElement('style')
        style.textContent = cssText
        document.head.appendChild(style)

        const sheet = style.sheet as CSSStyleSheet
        if (sheet?.cssRules) {
            for (let i = 0; i < sheet.cssRules.length; i++) {
                const rule = sheet.cssRules[i]
                if (rule.type === CSSRule.STYLE_RULE) {
                    const styleRule = rule as CSSStyleRule
                    const properties: Record<string, string> = {}

                    // Extract properties from the rule
                    for (let j = 0; j < styleRule.style.length; j++) {
                        const property = styleRule.style[j]
                        properties[property] = styleRule.style.getPropertyValue(property)
                    }

                    rules.push({
                        selector: styleRule.selectorText,
                        properties,
                        specificity: calculateSpecificity(styleRule.selectorText),
                    })
                }
            }
        }

        document.head.removeChild(style)
    } catch (error) {
        console.warn('Error parsing CSS rules:', error)
        // Fallback: simple regex parsing
        return parseCssWithRegex(cssText)
    }

    return rules
}

// Fallback CSS parsing using regex
const parseCssWithRegex = (cssText: string): CSSRule[] => {
    const rules: CSSRule[] = []
    const ruleRegex = /([^{]+)\s*\{([^}]+)\}/g
    let match

    while ((match = ruleRegex.exec(cssText)) !== null) {
        const selector = match[1].trim()
        const declarations = match[2].trim()
        const properties: Record<string, string> = {}

        // Parse declarations
        const declRegex = /([^:;]+):\s*([^;]+)/g
        let declMatch
        while ((declMatch = declRegex.exec(declarations)) !== null) {
            const property = declMatch[1].trim()
            const value = declMatch[2].trim()
            properties[property] = value
        }

        rules.push({
            selector,
            properties,
            specificity: calculateSpecificity(selector),
        })
    }

    return rules
}

// Calculate CSS specificity for proper rule ordering
const calculateSpecificity = (selector: string): number => {
    let specificity = 0

    // Count IDs (100 points each)
    specificity += (selector.match(/#[^\s+>~.[:]+/g) ?? []).length * 100

    // Count classes, attributes, pseudo-classes (10 points each)
    specificity += (selector.match(/\.[^\s+>~.[:]+|::[^\s+>~.[:]+|:[^\s+>~.[:]+|\[[^\]]*\]/g) ?? []).length * 10

    // Count elements and pseudo-elements (1 point each)
    specificity += (selector.match(/[^\s+>~.[:]+/g) ?? []).length * 1

    return specificity
}

// Extract mj-style CSS from elements
export const extractMjmlStyles = (elements: EditorElement[]): string => {
    const mjmlRoot = elements.find(e => e.tagName === 'mjml')
    if (!mjmlRoot) return ''

    const head = mjmlRoot.children?.find(c => c.tagName === 'mj-head')
    if (!head) return ''

    const styles = head.children?.filter(c => c.tagName === 'mj-style') ?? []
    return styles.map(s => s.content ?? '').join('\n\n')
}

// Extract mj-attributes from elements
export const extractMjmlAttributes = (elements: EditorElement[]): Record<string, Record<string, string>> => {
    const mjmlRoot = elements.find(e => e.tagName === 'mjml')
    if (!mjmlRoot) return {}

    const head = mjmlRoot.children?.find(c => c.tagName === 'mj-head')
    if (!head) return {}

    const attributesEl = head.children?.find(c => c.tagName === 'mj-attributes')
    if (!attributesEl) return {}

    const globalAttributes: Record<string, Record<string, string>> = {}

    attributesEl.children?.forEach(child => {
        if (child.tagName && child.attributes) {
            globalAttributes[child.tagName] = { ...child.attributes }
        }
    })

    return globalAttributes
}

// Extract mj-body element and its styles
export const extractMjmlBody = (elements: EditorElement[]): EditorElement | null => {
    const mjmlRoot = elements.find(e => e.tagName === 'mjml')
    if (!mjmlRoot) return null

    return mjmlRoot.children?.find(c => c.tagName === 'mj-body') ?? null
}

// Parse all styles from MJML elements
export const parseAllStyles = (elements: EditorElement[]): ParsedStyles => {
    const globalCss = extractMjmlStyles(elements)
    const globalAttributes = extractMjmlAttributes(elements)
    const cssRules = parseCssRules(globalCss)

    return {
        globalCss,
        globalAttributes,
        cssRules,
    }
}

// Apply global attributes to element attributes
export const applyGlobalAttributes = (
    elementTagName: string,
    elementAttributes: Record<string, any>,
    globalAttributes: Record<string, Record<string, string>>,
): Record<string, any> => {
    const result = { ...elementAttributes }

    // Apply mj-all attributes first (lowest priority)
    if (globalAttributes['mj-all']) {
        Object.entries(globalAttributes['mj-all']).forEach(([key, value]) => {
            if (!(key in result)) {
                result[key] = value
            }
        })
    }

    // Apply component-specific attributes (higher priority)
    if (globalAttributes[elementTagName]) {
        Object.entries(globalAttributes[elementTagName]).forEach(([key, value]) => {
            if (!(key in result)) {
                result[key] = value
            }
        })
    }

    return result
}

// Find matching CSS rules for an element
export const findMatchingCssRules = (
    elementTagName: string,
    elementClasses: string[],
    elementId?: string,
    cssRules: CSSRule[] = [],
): CSSRule[] => {
    const matchingRules: CSSRule[] = []

    cssRules.forEach(rule => {
        if (selectorMatches(rule.selector, elementTagName, elementClasses, elementId)) {
            matchingRules.push(rule)
        }
    })

    // Sort by specificity (higher specificity first)
    return matchingRules.sort((a, b) => b.specificity - a.specificity)
}

// Check if a CSS selector matches an element
const selectorMatches = (
    selector: string,
    tagName: string,
    classes: string[],
    id?: string,
): boolean => {
    // Simple selector matching - can be enhanced for complex selectors
    const normalizedSelector = selector.toLowerCase().trim()
    const normalizedTagName = tagName.toLowerCase()

    // Direct tag match
    if (normalizedSelector === normalizedTagName) return true

    // Class match
    if (normalizedSelector.startsWith('.')) {
        const className = normalizedSelector.substring(1)
        return classes.includes(className)
    }

    // ID match
    if (normalizedSelector.startsWith('#') && id) {
        const idName = normalizedSelector.substring(1)
        return id === idName
    }

    // Tag with class
    const tagClassMatch = normalizedSelector.match(/^([a-z-]+)\.([a-z-]+)$/i)
    if (tagClassMatch) {
        const [, selectorTag, selectorClass] = tagClassMatch
        return selectorTag === normalizedTagName && classes.includes(selectorClass)
    }

    // MJML-specific selectors
    if (normalizedSelector.includes(normalizedTagName)) {
        return true
    }

    return false
}

// Convert CSS properties to React CSSProperties
export const cssPropertiesToReact = (properties: Record<string, string>): React.CSSProperties => {
    const reactStyles: any = {}

    Object.entries(properties).forEach(([property, value]) => {
        // Convert kebab-case to camelCase
        const camelProperty = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())

        // Set the property directly on the styles object
        reactStyles[camelProperty] = value
    })

    return reactStyles as React.CSSProperties
}

// Apply mj-body styles to canvas container
export const getBodyStyles = (
    elements: EditorElement[],
    globalAttributes: Record<string, Record<string, string>>,
    cssRules: CSSRule[],
): React.CSSProperties => {
    const mjBody = extractMjmlBody(elements)
    if (!mjBody) return {}

    // Start with mj-body attributes
    let bodyAttributes = { ...mjBody.attributes }

    // Apply global mj-body attributes if any
    if (globalAttributes['mj-body']) {
        bodyAttributes = {
            ...globalAttributes['mj-body'],
            ...bodyAttributes, // Element attributes override global
        }
    }

    // Convert MJML attributes to CSS
    const baseStyles: React.CSSProperties = {}

    // Background
    if (bodyAttributes['background-color']) {
        baseStyles.backgroundColor = bodyAttributes['background-color']
    }
    if (bodyAttributes['background-url']) {
        baseStyles.backgroundImage = `url("${bodyAttributes['background-url']}")`
        baseStyles.backgroundRepeat = bodyAttributes['background-repeat'] || 'no-repeat'
        baseStyles.backgroundSize = bodyAttributes['background-size'] || 'cover'
        baseStyles.backgroundPosition = bodyAttributes['background-position'] || 'center'
    }

    // Typography
    if (bodyAttributes['font-family']) baseStyles.fontFamily = bodyAttributes['font-family']
    if (bodyAttributes['font-size']) baseStyles.fontSize = bodyAttributes['font-size']
    if (bodyAttributes.color) baseStyles.color = bodyAttributes.color

    // Width and alignment
    if (bodyAttributes.width) {
        baseStyles.width = bodyAttributes.width
        baseStyles.maxWidth = bodyAttributes.width
    } else {
        // Default MJML body width
        baseStyles.width = '600px'
        baseStyles.maxWidth = '600px'
    }

    // Center the body by default (MJML behavior)
    baseStyles.margin = '0 auto'

    // Apply CSS rules that match mj-body
    const bodyClasses = bodyAttributes.class ? bodyAttributes.class.split(' ') : []
    const bodyId = bodyAttributes.id
    const matchingRules = findMatchingCssRules('mj-body', bodyClasses, bodyId, cssRules)

    matchingRules.forEach(rule => {
        const cssProps = cssPropertiesToReact(rule.properties)
        Object.assign(baseStyles, cssProps)
    })

    return baseStyles
}
