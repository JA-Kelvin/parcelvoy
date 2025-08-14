// Prebuilt custom MJML templates for quick insertion
import { TemplateBlock } from '../types'

// NOTE: IDs here are placeholders and will be reassigned on insertion

// TemplateBlock interface moved to '../types' for global reuse

export const CUSTOM_TEMPLATES: TemplateBlock[] = [
    {
        id: 'tpl_enh_basic',
        name: 'Enhanced Section - Basic',
        description: 'Single enhanced section with centered text',
        elements: [
            {
                id: 'tpl_es1',
                type: 'enhanced-section',
                tagName: 'enhanced-section',
                attributes: {
                    'background-color': '#ffffff',
                    padding: '24px 0',
                },
                children: [
                    {
                        id: 'tpl_ec1',
                        type: 'mj-column',
                        tagName: 'mj-column',
                        attributes: { width: '100%' },
                        children: [
                            {
                                id: 'tpl_et1',
                                type: 'mj-text',
                                tagName: 'mj-text',
                                attributes: {
                                    'font-size': '18px',
                                    'line-height': '1.6',
                                    'text-align': 'center',
                                    color: '#374151',
                                },
                                children: [],
                                content: 'This is an Enhanced Section block. It behaves like an mj-section in the editor.',
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'tpl_enh_feature',
        name: 'Enhanced Feature Highlight',
        description: 'Enhanced two-column feature highlight with image and text',
        elements: [
            {
                id: 'tpl_es2',
                type: 'enhanced-section',
                tagName: 'enhanced-section',
                attributes: {
                    'background-color': '#ffffff',
                    padding: '24px 0',
                },
                children: [
                    {
                        id: 'tpl_ec2a',
                        type: 'mj-column',
                        tagName: 'mj-column',
                        attributes: { width: '40%' },
                        children: [
                            {
                                id: 'tpl_eimg1',
                                type: 'mj-image',
                                tagName: 'mj-image',
                                attributes: {
                                    src: 'https://via.placeholder.com/400x240?text=Feature',
                                    width: '400px',
                                    alt: 'Feature Image',
                                },
                                children: [],
                            },
                        ],
                    },
                    {
                        id: 'tpl_ec2b',
                        type: 'mj-column',
                        tagName: 'mj-column',
                        attributes: { width: '60%' },
                        children: [
                            {
                                id: 'tpl_et2',
                                type: 'mj-text',
                                tagName: 'mj-text',
                                attributes: {
                                    'font-size': '22px',
                                    'font-weight': '700',
                                    color: '#111827',
                                },
                                children: [],
                                content: 'Feature headline goes here',
                            },
                            {
                                id: 'tpl_et3',
                                type: 'mj-text',
                                tagName: 'mj-text',
                                attributes: {
                                    'font-size': '16px',
                                    color: '#374151',
                                    'line-height': '1.6',
                                },
                                children: [],
                                content: 'Describe your feature benefits succinctly. Enhanced Section supports all mj-section children.',
                            },
                            {
                                id: 'tpl_eb1',
                                type: 'mj-button',
                                tagName: 'mj-button',
                                attributes: {
                                    'background-color': '#2563eb',
                                    color: '#ffffff',
                                    'border-radius': '6px',
                                    padding: '12px 20px',
                                    'font-size': '16px',
                                    href: '#',
                                    align: 'left',
                                },
                                children: [],
                                content: 'Learn More',
                            },
                        ],
                    },
                ],
            },
        ],
    },
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
