// Example demonstrating mj-style and mj-attributes application in canvas edit mode
import { EditorElement } from '../types'

// Example MJML structure with mj-style and mj-attributes
export const exampleWithStyles: EditorElement[] = [
    {
        id: 'mjml-root',
        type: 'mjml',
        tagName: 'mjml',
        attributes: {},
        children: [
            {
                id: 'mj-head',
                type: 'mj-head',
                tagName: 'mj-head',
                attributes: {},
                children: [
                    // Global CSS styles
                    {
                        id: 'mj-style',
                        type: 'mj-style',
                        tagName: 'mj-style',
                        attributes: {},
                        children: [],
                        content: `
                            /* Global button styling */
                            .custom-button {
                                background-color: #ff6b6b !important;
                                border-radius: 25px !important;
                                font-weight: bold !important;
                            }
                            
                            /* Text styling */
                            mj-text {
                                font-family: 'Arial, sans-serif';
                                line-height: 1.6;
                            }
                            
                            /* Section styling */
                            .hero-section {
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                padding: 40px 20px;
                            }
                        `
                    },
                    // Global attributes
                    {
                        id: 'mj-attributes',
                        type: 'mj-attributes',
                        tagName: 'mj-attributes',
                        attributes: {},
                        children: [
                            {
                                id: 'mj-all-attrs',
                                type: 'mj-all',
                                tagName: 'mj-all',
                                attributes: {
                                    'font-family': 'Helvetica, Arial, sans-serif',
                                    'font-size': '14px',
                                    'color': '#333333'
                                },
                                children: []
                            },
                            {
                                id: 'mj-text-attrs',
                                type: 'mj-text',
                                tagName: 'mj-text',
                                attributes: {
                                    'line-height': '1.6',
                                    'padding': '10px 25px'
                                },
                                children: []
                            },
                            {
                                id: 'mj-button-attrs',
                                type: 'mj-button',
                                tagName: 'mj-button',
                                attributes: {
                                    'background-color': '#007bff',
                                    'color': '#ffffff',
                                    'border-radius': '6px',
                                    'padding': '12px 24px'
                                },
                                children: []
                            }
                        ]
                    }
                ]
            },
            {
                id: 'mj-body',
                type: 'mj-body',
                tagName: 'mj-body',
                attributes: {},
                children: [
                    {
                        id: 'hero-section',
                        type: 'mj-section',
                        tagName: 'mj-section',
                        attributes: {
                            'class': 'hero-section',
                            'background-color': '#f8f9fa'
                        },
                        children: [
                            {
                                id: 'hero-column',
                                type: 'mj-column',
                                tagName: 'mj-column',
                                attributes: {},
                                children: [
                                    {
                                        id: 'hero-text',
                                        type: 'mj-text',
                                        tagName: 'mj-text',
                                        attributes: {
                                            'align': 'center'
                                        },
                                        children: [],
                                        content: '<h1>Welcome to Our Newsletter!</h1><p>This text will inherit global mj-text attributes and styles.</p>'
                                    },
                                    {
                                        id: 'hero-button',
                                        type: 'mj-button',
                                        tagName: 'mj-button',
                                        attributes: {
                                            'class': 'custom-button',
                                            'align': 'center'
                                        },
                                        children: [],
                                        content: 'Get Started'
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'content-section',
                        type: 'mj-section',
                        tagName: 'mj-section',
                        attributes: {
                            'background-color': '#ffffff',
                            'padding': '20px 0'
                        },
                        children: [
                            {
                                id: 'content-column',
                                type: 'mj-column',
                                tagName: 'mj-column',
                                attributes: {},
                                children: [
                                    {
                                        id: 'content-text',
                                        type: 'mj-text',
                                        tagName: 'mj-text',
                                        attributes: {},
                                        children: [],
                                        content: 'This text will also inherit the global mj-text attributes (font-family, font-size, color, line-height, padding).'
                                    },
                                    {
                                        id: 'content-button',
                                        type: 'mj-button',
                                        tagName: 'mj-button',
                                        attributes: {
                                            'align': 'left'
                                        },
                                        children: [],
                                        content: 'Learn More'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    }
]

// Expected behavior in canvas edit mode:
// 1. The hero section will have gradient background from CSS class 'hero-section'
// 2. All text elements will inherit global font-family, font-size, color from mj-all
// 3. Text elements will also get line-height and padding from mj-text attributes
// 4. The first button will have custom styling from 'custom-button' CSS class (red background, rounded)
// 5. The second button will use default mj-button attributes (blue background, standard radius)
// 6. CSS styles will override mj-attributes when both are present
// 7. Individual element attributes will override both global attributes and CSS styles

export const testStyleApplication = () => {
    console.log('Example MJML with styles and attributes:', exampleWithStyles)
    console.log('This structure demonstrates:')
    console.log('- mj-style CSS rules that will be parsed and applied')
    console.log('- mj-attributes global defaults for components')
    console.log('- CSS class application (.custom-button, .hero-section)')
    console.log('- Inheritance hierarchy: element attributes > CSS > mj-attributes > defaults')
}
