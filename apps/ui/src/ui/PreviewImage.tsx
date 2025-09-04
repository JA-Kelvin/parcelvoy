import { ReactNode, useEffect, useState } from 'react'
import './PreviewImage.css'

interface PreviewImageProps {
    url: string
    width?: number
    height?: number
    iframeWidth?: number
    children?: ReactNode
}

export default function PreviewImage({
    url,
    width = 100,
    height = 100,
    iframeWidth = 600,
    children,
}: PreviewImageProps) {
    const iframeHeight = height * (iframeWidth / width)
    const [loaded, setLoaded] = useState(false)
    const [html, setHtml] = useState<string>('')

    useEffect(() => {
        let active = true
        const fetchHtml = async () => {
            try {
                const res = await fetch(url, { credentials: 'include' })
                const text = await res.text()
                if (active) {
                    setHtml(text)
                    if (text && text.trim().length > 0) setLoaded(true)
                }
            } catch (e) {
                if (active) setHtml('')
            }
        }
        void fetchHtml()
        return () => { active = false }
    }, [url])

    return (
        <section className="preview-image" style={{ width, height }}>
            <iframe
                frameBorder="0"
                scrolling="no"
                srcDoc={html}
                sandbox="allow-scripts allow-same-origin"
                width={iframeWidth}
                height={iframeHeight}
                style={{
                    transform: `scale(${width / iframeWidth})`,
                    display: loaded ? 'block' : 'none',
                }}
                onLoad={() => setLoaded((html ?? '').trim().length > 0)} />
            {!loaded && children }
        </section>
    )
}
