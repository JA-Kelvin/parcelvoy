// Centralized MJML allowed-children rules for Enhanced MJML Editor
// Keep this as the single source of truth for structure validation across
// Canvas, DroppableElement, and EnhancedMjmlEditor.

export const ALLOWED_CHILDREN: Record<string, string[]> = {
    // Root/body level
    mjml: ['mj-body'],
    'mj-body': ['mj-section', 'enhanced-section', 'mj-wrapper', 'mj-hero'],

    // Sections
    'mj-section': ['mj-column', 'mj-group'],
    'enhanced-section': ['mj-column', 'mj-group'],

    // Columns can contain most content blocks
    'mj-column': [
        'mj-text',
        'mj-image',
        'mj-button',
        'mj-divider',
        'mj-spacer',
        'mj-social',
        'mj-raw',
        'mj-navbar',
        'mj-table',
        'mj-accordion',
        'mj-carousel',
    ],

    // Groups
    'mj-group': ['mj-column'],

    // Wrapper is a container for sections only
    'mj-wrapper': ['mj-section', 'enhanced-section'],

    // Hero content (allowed direct children)
    'mj-hero': ['mj-text', 'mj-button', 'mj-image', 'mj-spacer'],

    // Compound components and their required children
    'mj-navbar': ['mj-navbar-link'],
    'mj-social': ['mj-social-element'],
    'mj-accordion': ['mj-accordion-element'],
    'mj-accordion-element': ['mj-accordion-title', 'mj-accordion-text'],
    'mj-carousel': ['mj-carousel-image'],
}

export const getAllowedChildren = (tagName: string): string[] => {
    return ALLOWED_CHILDREN[tagName] ?? []
}
