// Preview Modal Component for Enhanced MJML Editor
import React, { useState, useEffect } from 'react';
import { EditorElement } from '../types';
import { editorElementsToMjmlString, mjmlToHtml } from '../utils/mjmlParser';
import './PreviewModal.css';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: EditorElement[];
  templateName?: string;
}

const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  elements,
  templateName = 'Email Template'
}) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && elements.length > 0) {
      generatePreview();
    }
  }, [isOpen, elements]);

  const generatePreview = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const mjmlString = editorElementsToMjmlString(elements);
      const html = await mjmlToHtml(mjmlString);
      setHtmlContent(html);
    } catch (err) {
      console.error('Error generating preview:', err);
      setError('Failed to generate preview. Please check your email template.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const getViewportClass = () => {
    switch (viewMode) {
      case 'tablet':
        return 'preview-tablet';
      case 'mobile':
        return 'preview-mobile';
      default:
        return 'preview-desktop';
    }
  };

  const handleSendTestEmail = () => {
    // This would integrate with Parcelvoy's test email functionality
    console.log('Send test email functionality would be integrated here');
  };

  if (!isOpen) return null;

  return (
    <div className="preview-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <div className="preview-title">
            <h2>Preview: {templateName}</h2>
          </div>
          
          <div className="preview-controls">
            <div className="viewport-controls">
              <button
                className={`viewport-button ${viewMode === 'desktop' ? 'active' : ''}`}
                onClick={() => setViewMode('desktop')}
                title="Desktop View"
              >
                🖥️
              </button>
              <button
                className={`viewport-button ${viewMode === 'tablet' ? 'active' : ''}`}
                onClick={() => setViewMode('tablet')}
                title="Tablet View"
              >
                📱
              </button>
              <button
                className={`viewport-button ${viewMode === 'mobile' ? 'active' : ''}`}
                onClick={() => setViewMode('mobile')}
                title="Mobile View"
              >
                📱
              </button>
            </div>
            
            <div className="action-controls">
              <button
                className="action-button"
                onClick={handleSendTestEmail}
                title="Send Test Email"
              >
                📧 Test
              </button>
              <button
                className="action-button"
                onClick={generatePreview}
                disabled={isLoading}
                title="Refresh Preview"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
          
          <button className="close-button" onClick={onClose} title="Close Preview">
            ✕
          </button>
        </div>

        <div className="preview-content">
          {isLoading ? (
            <div className="preview-loading">
              <div className="loading-spinner"></div>
              <p>Generating preview...</p>
            </div>
          ) : error ? (
            <div className="preview-error">
              <div className="error-icon">⚠️</div>
              <h3>Preview Error</h3>
              <p>{error}</p>
              <button onClick={generatePreview} className="retry-button">
                Try Again
              </button>
            </div>
          ) : (
            <div className={`preview-viewport ${getViewportClass()}`}>
              <div className="preview-frame">
                <iframe
                  srcDoc={htmlContent}
                  title="Email Preview"
                  className="preview-iframe"
                  sandbox="allow-same-origin"
                />
              </div>
              
              <div className="preview-info">
                <div className="viewport-info">
                  {viewMode === 'desktop' && '🖥️ Desktop (600px+)'}
                  {viewMode === 'tablet' && '📱 Tablet (768px)'}
                  {viewMode === 'mobile' && '📱 Mobile (375px)'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="preview-footer">
          <div className="preview-stats">
            <span>Elements: {countElements(elements)}</span>
            <span>•</span>
            <span>Size: {Math.round(htmlContent.length / 1024)}KB</span>
          </div>
          
          <div className="preview-actions">
            <button onClick={onClose} className="secondary-button">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to count elements recursively
const countElements = (elements: EditorElement[]): number => {
  return elements.reduce((count, element) => {
    return count + 1 + (element.children ? countElements(element.children) : 0);
  }, 0);
};

export default PreviewModal;
