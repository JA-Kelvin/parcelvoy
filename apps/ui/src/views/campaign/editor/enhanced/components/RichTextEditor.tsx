// RichTextEditor: Quill v2-based inline editor for mj-text
import React from 'react'
import ReactQuill from 'react-quill'
import DOMPurify from 'dompurify'
import 'react-quill/dist/quill.snow.css'

interface RichTextEditorProps {
    content: string
    onSave: (html: string) => void
    onCancel: () => void
}

// Allowed HTML for mj-text content
const ALLOWED_TAGS = [
    'a', 'p', 'br', 'span', 'strong', 'em', 'u', 'b', 'i', 'ul', 'ol', 'li', 'blockquote',
]
const ALLOWED_ATTR = ['href', 'target', 'rel', 'style', 'class']

const sanitizeHtml = (html: string): string => {
    const cleaned = DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
        USE_PROFILES: { html: true },
    })

    // Ensure external links are safe (add rel and default target)
    try {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = cleaned
        const links = wrapper.querySelectorAll('a')
        links.forEach((a) => {
            const href = a.getAttribute('href') ?? ''
            // If it's an absolute link, open in new tab
            if (/^https?:\/\//i.test(href)) {
                a.setAttribute('target', '_blank')
                a.setAttribute('rel', 'noopener noreferrer')
            }
        })
        return wrapper.innerHTML
    } catch {
        return cleaned
    }
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onSave, onCancel }) => {
    const quillRef = React.useRef<ReactQuill | null>(null)
    const [value, setValue] = React.useState<string>(content || '')

    const modules = React.useMemo(() => ({
        toolbar: [
            [{ size: ['small', false, 'large', 'huge'] }],
            ['bold', 'italic', 'underline'],
            [{ color: [] }, { background: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link'],
            ['clean'],
        ],
        // Keep history minimal; our editor already has global undo/redo
        history: { delay: 600, maxStack: 50, userOnly: true },
        clipboard: { matchVisual: true },
    }), [])

    const formats = React.useMemo(
        () => ['bold', 'italic', 'underline', 'list', 'bullet', 'link', 'size', 'color', 'background'],
        [],
    )

    const commitSave = React.useCallback(() => {
        const editor = quillRef.current?.getEditor()
        const html = editor?.root.innerHTML ?? value
        const sanitized = sanitizeHtml(html)
        onSave(sanitized)
    }, [value, onSave])

    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
        // Ctrl/Cmd+Enter to save, Escape to cancel
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            commitSave()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
        }
        // Prevent bubbling to selection/drag handlers
        e.stopPropagation()
    }

    const handleWrapperBlur: React.FocusEventHandler<HTMLDivElement> = (e) => {
        // Only commit if focus leaves the entire editor wrapper
        const next = e.relatedTarget as Node | null
        if (!next || !e.currentTarget.contains(next)) {
            commitSave()
        }
    }

    return (
        <div
            className="rich-text-editor"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            onBlur={handleWrapperBlur}
        >
            <ReactQuill
                ref={quillRef}
                theme="snow"
                value={value}
                onChange={setValue}
                modules={modules}
                formats={formats}
                placeholder="Type your text..."
            />
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                Ctrl+Enter to save • Esc to cancel
            </div>
        </div>
    )
}

export default RichTextEditor
