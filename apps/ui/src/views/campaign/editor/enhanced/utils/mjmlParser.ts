// MJML Parser utilities adapted for Parcelvoy
import { EditorElement } from '../types'

// Generate unique ID for elements
export const generateId = (): string => {
    return `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Parse MJML string to editor elements
export const parseMJMLString = (mjmlString: string): EditorElement[] => {
    try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(mjmlString, 'text/xml')

        if (doc.documentElement.nodeName === 'parsererror') {
            throw new Error('Invalid MJML structure')
        }

        const mjmlElement = doc.querySelector('mjml')
        if (!mjmlElement) {
            throw new Error('No MJML root element found')
        }

        return parseElementRecursive(mjmlElement)
    } catch (error) {
        console.error('Error parsing MJML:', error)
        // Return default structure on error
        return [{
            id: generateId(),
            type: 'mjml',
            tagName: 'mjml',
            attributes: {},
            children: [{
                id: generateId(),
                type: 'mj-body',
                tagName: 'mj-body',
                attributes: {},
                children: [],
            }],
        }]
    }
}

// Parse DOM element to editor element recursively
const parseElementRecursive = (element: Element): EditorElement[] => {
    const result: EditorElement[] = []

    for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i]
        const editorElement: EditorElement = {
            id: generateId(),
            type: child.tagName.toLowerCase(),
            tagName: child.tagName.toLowerCase(),
            attributes: {},
            children: [],
        }

        // Parse attributes
        for (let j = 0; j < child.attributes.length; j++) {
            const attr = child.attributes[j]
            editorElement.attributes[attr.name] = attr.value
        }

        // Parse text content for leaf nodes
        if (child.children.length === 0 && child.textContent?.trim()) {
            editorElement.content = child.textContent.trim()
        }

        // Parse children recursively
        if (child.children.length > 0) {
            editorElement.children = parseElementRecursive(child)
        }

        result.push(editorElement)
    }

    return result
}

// Convert editor elements to MJML string
export const editorElementsToMjmlString = (elements: EditorElement[]): string => {
    if (!elements || elements.length === 0) {
        return '<mjml><mj-body></mj-body></mjml>'
    }

    return elements.map(element => elementToMjmlString(element)).join('')
}

// Convert single element to MJML string recursively
const elementToMjmlString = (element: EditorElement): string => {
    const { tagName, attributes, content, children } = element

    // Build attributes string
    const attributesString = Object.entries(attributes || {})
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ')

    const attributesPart = attributesString ? ` ${attributesString}` : ''

    // Handle void elements (self-closing)
    const voidElements = ['mj-image', 'mj-divider', 'mj-spacer', 'mj-raw']
    if (voidElements.includes(tagName) && !content && (!children || children.length === 0)) {
        return `<${tagName}${attributesPart} />`
    }

    // Handle elements with content
    if (content && (!children || children.length === 0)) {
        return `<${tagName}${attributesPart}>${content}</${tagName}>`
    }

    // Handle elements with children
    const childrenString = children?.map(child => elementToMjmlString(child)).join('') || ''
    return `<${tagName}${attributesPart}>${childrenString}</${tagName}>`
}

// Convert MJML to HTML using mjml-browser
export const mjmlToHtml = async (mjmlString: string): Promise<string> => {
    try {
        // Dynamic import to handle potential SSR issues
        const mjml = await import('mjml-browser') as any
        const result = mjml.default(mjmlString)

        if (result.errors && result.errors.length > 0) {
            console.warn('MJML compilation warnings:', result.errors)
        }

        return result.html
    } catch (error) {
        console.error('Error converting MJML to HTML:', error)
        return '<html><body><p>Error rendering email</p></body></html>'
    }
}

// Validate MJML structure
export const validateMjmlStructure = (elements: EditorElement[]): boolean => {
    if (!elements || elements.length === 0) return false

    const mjmlRoot = elements.find(el => el.tagName === 'mjml')
    if (!mjmlRoot) return false

    const mjmlBody = mjmlRoot.children?.find(el => el.tagName === 'mj-body')
    return !!mjmlBody
}

// Create default MJML structure
export const createDefaultMjmlStructure = (): EditorElement[] => {
    return [{
        id: generateId(),
        type: 'mjml',
        tagName: 'mjml',
        attributes: {},
        children: [{
            id: generateId(),
            type: 'mj-body',
            tagName: 'mj-body',
            attributes: {
                'background-color': '#f4f4f4',
            },
            children: [{
                id: generateId(),
                type: 'mj-section',
                tagName: 'mj-section',
                attributes: {
                    'background-color': '#ffffff',
                    padding: '20px',
                },
                children: [{
                    id: generateId(),
                    type: 'mj-column',
                    tagName: 'mj-column',
                    attributes: {},
                    children: [{
                        id: generateId(),
                        type: 'mj-text',
                        tagName: 'mj-text',
                        attributes: {
                            'font-size': '16px',
                            color: '#333333',
                        },
                        children: [],
                        content: 'Welcome to your new email template!',
                    }],
                }],
            }],
        }],
    }]
}
