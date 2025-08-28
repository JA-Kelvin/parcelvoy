// MJML Parser utilities adapted for Parcelvoy
import { EditorElement } from '../types'

// Generate unique ID for elements
export const generateId = (): string => {
    return `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// --- Internal helpers for robust parsing ---
// 1) Wrap content in <mjml><mj-body>...</mj-body></mjml> when a fragment is provided
const wrapIfFragment = (input: string): string => {
    const s = String(input || '').trim()
    if (!s) return '<mjml>\n  <mj-body></mj-body>\n</mjml>'
    // If already a full document, return as-is
    if (/<\s*mjml[\s>]/i.test(s)) return s
    // If it contains any mj-* tags, treat as fragment and wrap
    if (/<\s*mj-[a-z-]+[\s>]/i.test(s)) {
        return `<mjml>\n  <mj-body>\n${s}\n  </mj-body>\n</mjml>`
    }
    // Otherwise, leave as-is (could be HTML; upstream may handle separately)
    return s
}

// 2) Sanitize stray ampersands so XML parser won't choke on href/src query strings
// Converts & to &amp; unless it's already an entity like &amp; or &#123; or &name;
const sanitizeStrayAmpersands = (input: string): string => {
    const s = String(input || '')
    // Replace any & not followed by an entity pattern with &amp;
    return s.replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]+;)/g, '&amp;')
}

// 3) Try to parse as XML and detect parsererror consistently
const parseXmlDoc = (content: string): Document | null => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/xml')
    // Some environments expose <parsererror> as the documentElement, others embed it
    const rootName = doc.documentElement?.nodeName?.toLowerCase()
    if (rootName === 'parsererror' || doc.getElementsByTagName('parsererror').length > 0) {
        return null
    }
    return doc
}

// 4) Fallback: parse as HTML (lenient) to recover from minor XML issues
const parseHtmlDoc = (content: string): Document => {
    const parser = new DOMParser()
    return parser.parseFromString(content, 'text/html')
}

// Public helper to serialize a single element subtree (without wrapping mjml/mj-body)
export const serializeElementToMjml = (element: EditorElement): string => {
    return elementToMjmlString(element, 0)
}

// Parse MJML string to editor elements
export const parseMJMLString = (mjmlString: string): EditorElement[] => {
    try {
        const original = String(mjmlString || '')
        // Step 1: ensure fragments are wrapped
        const wrapped = wrapIfFragment(original)
        // Step 2: sanitize stray ampersands to satisfy XML parser
        const sanitized = sanitizeStrayAmpersands(wrapped)

        // First attempt: strict XML parse
        let doc = parseXmlDoc(sanitized)

        // If XML failed, try HTML fallback (lenient)
        if (!doc) {
            const htmlDoc = parseHtmlDoc(sanitized)
            const mjmlEl = htmlDoc.querySelector('mjml')
            if (!mjmlEl) {
                // As a last resort, wrap the entire HTML body content inside mjml/mj-body and retry XML parse
                const bodyHtml = htmlDoc.body ? htmlDoc.body.innerHTML : sanitized
                const rewrapped = wrapIfFragment(bodyHtml)
                doc = parseXmlDoc(sanitizeStrayAmpersands(rewrapped))
            } else {
                // Serialize the mjml subtree back to a string and reparse as XML to normalize
                const serializer = new XMLSerializer()
                const mjmlHtml = serializer.serializeToString(mjmlEl)
                doc = parseXmlDoc(mjmlHtml)
            }
        }

        if (!doc) throw new Error('Invalid MJML structure after recovery attempts')

        const mjmlElement = doc.querySelector('mjml')
        if (!mjmlElement) throw new Error('No MJML root element found')

        // Create the MJML root element with its children
        const mjmlRoot: EditorElement = {
            id: generateId(),
            type: 'mjml',
            tagName: 'mjml',
            attributes: {},
            children: parseElementRecursive(mjmlElement),
        }

        // Parse attributes of the mjml element
        for (let i = 0; i < mjmlElement.attributes.length; i++) {
            const attr = mjmlElement.attributes[i]
            mjmlRoot.attributes[attr.name] = attr.value
        }

        return [mjmlRoot]
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

        // Tags whose inner HTML should be treated as content rather than parsed into child elements
        const contentHtmlTags = new Set([
            'mj-text',
            'mj-button',
            'mj-raw',
            'mj-table',
            'mj-accordion-title',
            'mj-accordion-text',
            'mj-navbar-link',
        ])

        if (contentHtmlTags.has(editorElement.tagName)) {
            // Serialize inner nodes to preserve HTML structure
            const serializer = new XMLSerializer()
            let inner = ''
            for (let n = 0; n < child.childNodes.length; n++) {
                inner += serializer.serializeToString(child.childNodes[n])
            }
            const innerTrimmed = inner.trim()
            if (innerTrimmed) {
                editorElement.content = innerTrimmed
            } else if (child.textContent?.trim()) {
                // Fallback to textContent if serializer produced empty string
                editorElement.content = child.textContent.trim()
            }
        } else {
            // Parse text content for leaf nodes
            if (child.children.length === 0 && child.textContent?.trim()) {
                editorElement.content = child.textContent.trim()
            }

            // Parse children recursively for structural MJML tags
            if (child.children.length > 0) {
                editorElement.children = parseElementRecursive(child)
            }
        }

        result.push(editorElement)
    }

    return result
}

// Convert editor elements to MJML string with proper formatting
export const editorElementsToMjmlString = (elements: EditorElement[] | any): string => {
    // Ensure elements is an array
    if (!elements || !Array.isArray(elements) || elements.length === 0) {
        return '<mjml>\n  <mj-body></mj-body>\n</mjml>'
    }

    // Find the mjml root element
    const mjmlRoot = elements.find(el => el && typeof el === 'object' && el.tagName === 'mjml')

    // If there's a valid mjml root, convert it
    if (mjmlRoot) {
        return elementToMjmlString(mjmlRoot, 0)
    }

    // If no mjml root found, wrap the elements in a proper mjml structure
    // First, look for mj-body element
    const mjBodyElement = elements.find(el => el.tagName === 'mj-body')

    if (mjBodyElement) {
        // If mj-body exists, wrap it in mjml
        return `<mjml>\n${elementToMjmlString(mjBodyElement, 1)}\n</mjml>`
    }

    // If no mjml or mj-body found, create a complete structure
    const elementsString = elements.map(element => elementToMjmlString(element, 2)).join('\n')
    return `<mjml>\n  <mj-body>\n${elementsString}\n  </mj-body>\n</mjml>`
}

// Convert single element to MJML string recursively with proper indentation
const elementToMjmlString = (element: EditorElement, indentLevel: number = 0): string => {
    const { tagName, attributes, content, children } = element
    const indent = '  '.repeat(indentLevel)
    const childIndent = '  '.repeat(indentLevel + 1)

    // Map editor-only/custom tags to valid MJML tags
    const actualTagName = tagName === 'enhanced-section' ? 'mj-section' : tagName

    // Helper: escape attribute values for valid XML
    const escapeAttributeValue = (v: any): string => {
        const s = String(v ?? '')
        return s
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
    }

    // Build attributes string
    const attributesString = Object.entries(attributes || {})
        .map(([key, value]) => `${key}="${escapeAttributeValue(value)}"`)
        .join(' ')

    const attributesPart = attributesString ? ` ${attributesString}` : ''

    // Handle void elements (self-closing)
    const voidElements = ['mj-image', 'mj-divider', 'mj-spacer', 'mj-carousel-image']
    if (voidElements.includes(actualTagName) && !content && (!children || children.length === 0)) {
        return `${indent}<${actualTagName}${attributesPart} />`
    }

    // Handle elements with content only (no children)
    if (content && (!children || children.length === 0)) {
        const safeContent = sanitizeStrayAmpersands(String(content))
        // For text elements, preserve content formatting
        if (actualTagName === 'mj-text' || actualTagName === 'mj-button') {
            return `${indent}<${actualTagName}${attributesPart}>\n${childIndent}${safeContent}\n${indent}</${actualTagName}>`
        } else {
            return `${indent}<${actualTagName}${attributesPart}>${safeContent}</${actualTagName}>`
        }
    }

    // Handle elements with children
    if (children && children.length > 0) {
        const childrenString = children
            .map(child => elementToMjmlString(child, indentLevel + 1))
            .join('\n')
        return `${indent}<${actualTagName}${attributesPart}>\n${childrenString}\n${indent}</${actualTagName}>`
    }

    // Handle empty elements
    return `${indent}<${actualTagName}${attributesPart}></${actualTagName}>`
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
                    padding: '0px',
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
