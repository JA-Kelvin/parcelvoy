// Error Boundary Component for Enhanced MJML Editor
import React, { Component, ErrorInfo, ReactNode } from 'react'
import './ErrorBoundary.css'

interface ErrorBoundaryProps {
    children: ReactNode
    fallback?: ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
    resetOnPropsChange?: boolean
    resetKeys?: Array<string | number>
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
    errorInfo: ErrorInfo | null
    lastResetKeys?: Array<string | number>
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            lastResetKeys: props.resetKeys,
        }
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return {
            hasError: true,
            error,
        }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo)

        this.setState({
            error,
            errorInfo,
        })

        // Call onError callback if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo)
        }
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps) {
        const { resetKeys, resetOnPropsChange } = this.props
        const { hasError, lastResetKeys } = this.state

        // Reset error boundary if resetKeys changed
        if (hasError && resetKeys && lastResetKeys) {
            const hasResetKeyChanged = resetKeys.some(
                (key, index) => key !== lastResetKeys[index],
            )

            if (hasResetKeyChanged) {
                this.resetErrorBoundary()
            }
        }

        // Reset error boundary if resetOnPropsChange is true and props changed
        if (hasError && resetOnPropsChange && prevProps !== this.props) {
            this.resetErrorBoundary()
        }
    }

    resetErrorBoundary = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            lastResetKeys: this.props.resetKeys,
        })
    }

    render() {
        const { hasError, error, errorInfo } = this.state
        const { children, fallback } = this.props

        if (hasError) {
            // Custom fallback UI
            if (fallback) {
                return fallback
            }

            // Default error UI
            return (
                <div className="error-boundary">
                    <div className="error-boundary-content">
                        <div className="error-icon">⚠️</div>
                        <h3>Something went wrong</h3>
                        <p>The enhanced MJML editor encountered an error and needs to be reset.</p>

                        <div className="error-actions">
                            <button
                                className="error-button primary"
                                onClick={this.resetErrorBoundary}
                            >
                                Try Again
                            </button>
                            <button
                                className="error-button secondary"
                                onClick={() => window.location.reload()}
                            >
                                Reload Page
                            </button>
                        </div>

                        <details className="error-details">
                            <summary>Technical Details</summary>
                            <div className="error-stack">
                                <strong>Error:</strong> {error?.message}
                                <br />
                                <strong>Stack:</strong>
                                <pre>{error?.stack}</pre>
                                {errorInfo && (
                                    <>
                                        <strong>Component Stack:</strong>
                                        <pre>{errorInfo.componentStack}</pre>
                                    </>
                                )}
                            </div>
                        </details>
                    </div>
                </div>
            )
        }

        return children
    }
}

export default ErrorBoundary
