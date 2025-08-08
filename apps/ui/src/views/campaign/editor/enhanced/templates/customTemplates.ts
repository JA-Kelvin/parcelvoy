// Prebuilt custom MJML templates for quick insertion
import { EditorElement } from '../types'

// NOTE: IDs here are placeholders and will be reassigned on insertion

export interface TemplateBlock {
    id: string
    name: string
    description?: string
    elements: EditorElement[] // elements to be appended under mj-body
}

export const CUSTOM_TEMPLATES: TemplateBlock[] = [
    {
        id: 'tpl_hero_cta',
        name: 'Hero with CTA',
        description: 'Headline, subtext and primary button in a full-width section',
        elements: [
            {
                id: 'tpl_s1',
                type: 'mj-section',
                tagName: 'mj-section',
                attributes: {
                    'background-color': '#ffffff',
                    padding: '32px 0',
                },
                children: [
                    {
                        id: 'tpl_c1',
                        type: 'mj-column',
                        tagName: 'mj-column',
                        attributes: { width: '100%' },
                        children: [
                            {
                                id: 'tpl_t1',
                                type: 'mj-text',
                                tagName: 'mj-text',
                                attributes: {
                                    'font-size': '24px',
                                    'font-weight': '700',
                                    'line-height': '1.3',
                                    'text-align': 'center',
                                    color: '#111827',
                                },
                                children: [],
                                content: 'Welcome to our Summer Sale',
                            },
                            {
                                id: 'tpl_t2',
                                type: 'mj-text',
                                tagName: 'mj-text',
                                attributes: {
                                    'font-size': '16px',
                                    'line-height': '1.6',
                                    'text-align': 'center',
                                    color: '#4b5563',
                                },
                                children: [],
                                content: 'Enjoy exclusive discounts on our latest collection for a limited time only.',
                            },
                            {
                                id: 'tpl_b1',
                                type: 'mj-button',
                                tagName: 'mj-button',
                                attributes: {
                                    'background-color': '#2563eb',
                                    color: '#ffffff',
                                    'border-radius': '6px',
                                    padding: '14px 24px',
                                    'font-size': '16px',
                                    href: '#',
                                    align: 'center',
                                },
                                children: [],
                                content: 'Shop Now',
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'tpl_two_cols',
        name: 'Two Columns',
        description: 'Two equal columns with text content',
        elements: [
            {
                id: 'tpl_s2',
                type: 'mj-section',
                tagName: 'mj-section',
                attributes: {
                    'background-color': '#ffffff',
                    padding: '24px 0',
                },
                children: [
                    {
                        id: 'tpl_c2a',
                        type: 'mj-column',
                        tagName: 'mj-column',
                        attributes: { width: '50%' },
                        children: [
                            {
                                id: 'tpl_t2a',
                                type: 'mj-text',
                                tagName: 'mj-text',
                                attributes: {
                                    'font-size': '16px',
                                    color: '#374151',
                                },
                                children: [],
                                content: 'Use this area to describe your product or feature. Keep it concise and compelling.',
                            },
                        ],
                    },
                    {
                        id: 'tpl_c2b',
                        type: 'mj-column',
                        tagName: 'mj-column',
                        attributes: { width: '50%' },
                        children: [
                            {
                                id: 'tpl_t2b',
                                type: 'mj-text',
                                tagName: 'mj-text',
                                attributes: {
                                    'font-size': '16px',
                                    color: '#374151',
                                },
                                children: [],
                                content: 'Pair your content with a secondary message, detail, or supporting information here.',
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'tpl_header_divider',
        name: 'Header + Divider',
        description: 'Logo image followed by a subtle divider',
        elements: [
            {
                id: 'tpl_s3',
                type: 'mj-section',
                tagName: 'mj-section',
                attributes: {
                    'background-color': '#ffffff',
                    padding: '16px 0 8px 0',
                },
                children: [
                    {
                        id: 'tpl_c3',
                        type: 'mj-column',
                        tagName: 'mj-column',
                        attributes: { width: '100%' },
                        children: [
                            {
                                id: 'tpl_img1',
                                type: 'mj-image',
                                tagName: 'mj-image',
                                attributes: {
                                    src: 'https://via.placeholder.com/160x40?text=Logo',
                                    width: '160px',
                                    align: 'left',
                                    alt: 'Logo',
                                },
                                children: [],
                            },
                        ],
                    },
                ],
            },
            {
                id: 'tpl_s3b',
                type: 'mj-section',
                tagName: 'mj-section',
                attributes: {
                    'background-color': '#ffffff',
                    padding: '0 0 16px 0',
                },
                children: [
                    {
                        id: 'tpl_c3b',
                        type: 'mj-column',
                        tagName: 'mj-column',
                        attributes: { width: '100%' },
                        children: [
                            {
                                id: 'tpl_div1',
                                type: 'mj-divider',
                                tagName: 'mj-divider',
                                attributes: {
                                    'border-color': '#e5e7eb',
                                    'border-width': '1px',
                                },
                                children: [],
                            },
                        ],
                    },
                ],
            },
        ],
    },
]
