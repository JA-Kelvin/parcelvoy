// RichTextEditor: Quill v2-based inline editor for mj-text (no react-quill)
import React from 'react'
import Quill from 'quill'
import DOMPurify from 'dompurify'
import 'quill/dist/quill.snow.css'

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
    const wrapperRef = React.useRef<HTMLDivElement | null>(null)
    const editorRef = React.useRef<HTMLDivElement | null>(null)
    const toolbarRef = React.useRef<HTMLElement | null>(null)
    const quillRef = React.useRef<Quill | null>(null)
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
    // Mount: initialize Quill ONCE to avoid duplicate toolbars
    React.useEffect(() => {
        if (editorRef.current == null || quillRef.current) return

        const q = new Quill(editorRef.current, {
            theme: 'snow',
            placeholder: 'Type your text...',
            modules,
        })
        quillRef.current = q

        // Initialize with sanitized HTML
        const initial = sanitizeHtml(content || '')
        q.clipboard.dangerouslyPasteHTML(initial)
        setValue(q.root.innerHTML)

        // Track content changes
        q.on('text-change', () => {
            setValue(q.root.innerHTML)
        })

        // Capture toolbar container to prevent blur-commit when interacting with toolbar
        const toolbarModule = q.getModule('toolbar') as any
        if (toolbarModule?.container) {
            toolbarRef.current = toolbarModule.container as HTMLElement
        }

        // Focus editor and move caret to end after mount
        // Use a microtask to ensure DOM is ready
        void Promise.resolve().then(() => {
            try {
                q.focus()
                const len = q.getLength()
                q.setSelection(len, 0)
            } catch {}
        })

        return () => {
            if (quillRef.current) {
                quillRef.current = null
            }
            toolbarRef.current = null
        }
    // Empty dependency array ensures this runs only once on mount
    }, [])

    // Update content in existing Quill instance when prop changes (no re-init)
    React.useEffect(() => {
        const q = quillRef.current
        if (!q) return

        const sanitized = sanitizeHtml(content || '')
        const current = q.root.innerHTML

        if (sanitized !== current) {
            const sel = q.getSelection()
            // Temporarily remove text-change handler to avoid setValue loop
            const textChangeHandlers = q.emitter.listeners('text-change')
            q.emitter.removeAllListeners('text-change')

            // Update content
            q.clipboard.dangerouslyPasteHTML(sanitized)
            setValue(q.root.innerHTML)

            // Restore handlers
            textChangeHandlers.forEach(handler =>
                q.emitter.on('text-change', handler),
            )

            // Try to restore selection near end
            const len = q.getLength()
            q.setSelection(sel ? Math.min(sel.index, len - 1) : len, 0)
        }
    }, [content])

    const commitSave = React.useCallback(() => {
        const html = quillRef.current?.root.innerHTML ?? value
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
        // Only commit if focus leaves the editor and its toolbar
        const next = e.relatedTarget as Node | null
        const stillInWrapper = next && wrapperRef.current?.contains(next)
        const inToolbar = next && toolbarRef.current?.contains(next)
        if (!stillInWrapper && !inToolbar) {
            commitSave()
        }
    }

    return (
        <div
            ref={wrapperRef}
            className="rich-text-editor"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            onBlur={handleWrapperBlur}
        >
            <div ref={editorRef} />
            <div style={{ fontSize: 12, color: 'var(--color-primary-soft)', marginTop: 6 }}>
                Ctrl+Enter to save • Esc to cancel
            </div>
        </div>
    )
}

export default RichTextEditor
