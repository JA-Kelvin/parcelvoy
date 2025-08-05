// Enhanced Components Panel for Parcelvoy MJML Editor
import React from 'react';
import { ComponentDefinition } from '../types';
import './ComponentsPanel.css';

interface ComponentsPanelProps {
  onComponentDrag: (component: ComponentDefinition) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// MJML Component definitions
const MJML_COMPONENTS: ComponentDefinition[] = [
  // Layout Components
  {
    type: 'mj-section',
    tagName: 'mj-section',
    displayName: 'Section',
    category: 'layout',
    icon: '📐',
    defaultAttributes: {
      'background-color': '#ffffff',
      'padding': '20px 0'
    },
    allowedChildren: ['mj-column', 'mj-group']
  },
  {
    type: 'mj-column',
    tagName: 'mj-column',
    displayName: 'Column',
    category: 'layout',
    icon: '📏',
    defaultAttributes: {
      'width': '100%'
    },
    allowedChildren: ['mj-text', 'mj-image', 'mj-button', 'mj-divider', 'mj-spacer', 'mj-social', 'mj-raw']
  },
  {
    type: 'mj-group',
    tagName: 'mj-group',
    displayName: 'Group',
    category: 'layout',
    icon: '🗂️',
    defaultAttributes: {},
    allowedChildren: ['mj-column']
  },
  
  // Content Components
  {
    type: 'mj-text',
    tagName: 'mj-text',
    displayName: 'Text',
    category: 'content',
    icon: '📝',
    defaultAttributes: {
      'font-size': '16px',
      'color': '#333333',
      'line-height': '1.5'
    }
  },
  {
    type: 'mj-button',
    tagName: 'mj-button',
    displayName: 'Button',
    category: 'content',
    icon: '🔘',
    defaultAttributes: {
      'background-color': '#007bff',
      'color': '#ffffff',
      'border-radius': '4px',
      'padding': '12px 24px',
      'font-size': '16px'
    }
  },
  {
    type: 'mj-navbar',
    tagName: 'mj-navbar',
    displayName: 'Navigation',
    category: 'content',
    icon: '🧭',
    defaultAttributes: {
      'background-color': '#ffffff'
    },
    allowedChildren: ['mj-navbar-link']
  },
  
  // Media Components
  {
    type: 'mj-image',
    tagName: 'mj-image',
    displayName: 'Image',
    category: 'media',
    icon: '🖼️',
    defaultAttributes: {
      'width': '100%',
      'alt': 'Image'
    },
    isVoid: true
  },
  {
    type: 'mj-hero',
    tagName: 'mj-hero',
    displayName: 'Hero',
    category: 'media',
    icon: '🎭',
    defaultAttributes: {
      'mode': 'fluid-height',
      'background-color': '#f0f0f0',
      'padding': '40px 0'
    },
    allowedChildren: ['mj-text', 'mj-button']
  },
  
  // Social Components
  {
    type: 'mj-social',
    tagName: 'mj-social',
    displayName: 'Social',
    category: 'social',
    icon: '📱',
    defaultAttributes: {
      'mode': 'horizontal'
    },
    allowedChildren: ['mj-social-element']
  },
  
  // Utility Components
  {
    type: 'mj-divider',
    tagName: 'mj-divider',
    displayName: 'Divider',
    category: 'content',
    icon: '➖',
    defaultAttributes: {
      'border-color': '#cccccc',
      'border-width': '1px'
    },
    isVoid: true
  },
  {
    type: 'mj-spacer',
    tagName: 'mj-spacer',
    displayName: 'Spacer',
    category: 'content',
    icon: '⬜',
    defaultAttributes: {
      'height': '20px'
    },
    isVoid: true
  },
  {
    type: 'mj-raw',
    tagName: 'mj-raw',
    displayName: 'Raw HTML',
    category: 'content',
    icon: '🔧',
    defaultAttributes: {},
    isVoid: true
  }
];

const ComponentsPanel: React.FC<ComponentsPanelProps> = ({
  onComponentDrag,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const categories = ['layout', 'content', 'media', 'social'] as const;
  
  const getComponentsByCategory = (category: string) => {
    return MJML_COMPONENTS.filter(comp => comp.category === category);
  };

  const handleDragStart = (e: React.DragEvent, component: ComponentDefinition) => {
    e.dataTransfer.setData('application/json', JSON.stringify(component));
    e.dataTransfer.effectAllowed = 'copy';
    onComponentDrag(component);
  };

  if (isCollapsed) {
    return (
      <div className="components-panel collapsed">
        <button 
          className="toggle-button"
          onClick={onToggleCollapse}
          title="Expand Components Panel"
        >
          📦
        </button>
      </div>
    );
  }

  return (
    <div className="components-panel">
      <div className="panel-header">
        <h3>Components</h3>
        <button 
          className="toggle-button"
          onClick={onToggleCollapse}
          title="Collapse Components Panel"
        >
          ✕
        </button>
      </div>
      
      <div className="panel-content">
        {categories.map(category => {
          const components = getComponentsByCategory(category);
          if (components.length === 0) return null;
          
          return (
            <div key={category} className="component-category">
              <h4 className="category-title">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </h4>
              
              <div className="component-grid">
                {components.map(component => (
                  <div
                    key={component.type}
                    className="component-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, component)}
                    title={component.displayName}
                  >
                    <div className="component-icon">
                      {component.icon}
                    </div>
                    <div className="component-name">
                      {component.displayName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="panel-footer">
        <small>Drag components to canvas</small>
      </div>
    </div>
  );
};

export default ComponentsPanel;
