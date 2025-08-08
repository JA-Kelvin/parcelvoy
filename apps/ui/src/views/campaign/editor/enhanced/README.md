# Enhanced MJML Editor (Parcelvoy)

A modern, visual MJML email editor with multi-view preview, robust drag-and-drop, undo/redo, import/export, and custom template blocks. This document is designed so another AI/engineer can replicate the feature set and architecture.

## Purpose
- Provide a visual MJML authoring experience that enforces MJML structure.
- Support import of MJML/HTML, enhanced preview (visual + code), and saving via existing Parcelvoy APIs.
- Enable reusable custom blocks (prebuilt and user-defined) with preview-confirm insertion and persistence.

## Key Features
- **Visual canvas with MJML-aware DnD**: Components and groups auto-scaffold to satisfy MJML constraints.
- **Enhanced Preview Modal** (`EnhancedPreviewModal.tsx`):
  - Visual preview (desktop/tablet/mobile), MJML code, and HTML code tabs.
  - Copy-to-clipboard for MJML/HTML.
  - Optional confirm button, supporting Ctrl/Cmd+Enter to confirm.
- **Import MJML/HTML** (`ImportMjmlModal.tsx`):
  - Paste full MJML docs or HTML; validates and converts for editor.
- **Custom Templates** (`templates/customTemplates.ts` + user-defined):
  - Click opens preview modal → confirm to insert.
  - Elements cloned with new IDs and inserted under `<mj-body>`.
  - Persisted in template `data.customTemplates` on save.
- **Undo/Redo**: History-based reducer with selection and tree operations.
- **Save Integration**: Uses existing Parcelvoy API patterns to persist template updates.

## Directory Layout
- `components/`
  - `EnhancedPreviewModal.tsx` – Enhanced preview with confirm.
  - `ImportMjmlModal.tsx` – Import MJML/HTML dialog.
  - `ComponentsPanel.tsx` – Palette for MJML components and templates.
  - `Canvas.tsx` – Canvas, drop logic and structure scaffolding.
  - `DroppableElement.tsx` – DnD wrapper and element rendering.
- `EnhancedMjmlEditor.tsx` – Orchestrates state, panels, modals, save, and keyboard shortcuts.
- `templates/customTemplates.ts` – Prebuilt `TemplateBlock[]`.
- `types.ts`, `utils/` – Editor types and MJML helpers (parse/serialize/convert).

## Data Model
```ts
// Minimal shape used across editor
export interface EditorElement {
  id: string
  type: string         // e.g., 'mj-section', 'mj-column', 'mj-text'
  tagName: string      // canonical MJML tag, e.g., 'mj-section'
  attributes?: Record<string, string>
  content?: string
  children?: EditorElement[]
}

export interface TemplateBlock {
  id: string
  name: string
  description?: string
  elements: EditorElement[]
}

// Stored on Parcelvoy template.data
export interface EnhancedTemplateData {
  editor: 'enhanced-visual'
  mjml: string
  html: string
  elements: EditorElement[]
  customTemplates?: TemplateBlock[]
  metadata?: { savedAt?: string; name?: string }
}
```

## Core Editor State and Reducer
- State is a history container: `{ present, history, future, selectedElementId, templateId }`.
- Actions cover add/update/move/delete/select/replace-present and template load.
- Undo/redo integrated with keyboard shortcuts.

## MJML Structure Enforcement (Canvas)
When dropping items on the canvas (`components/Canvas.tsx`):
- **`mj-hero`/`mj-wrapper`** added directly under `mj-body`.
- **`mj-group`** added under a section and auto-creates default `mj-column` inside it.
- Subcomponents auto-scaffold parents when needed:
  - `mj-navbar-link` → ensures `mj-navbar` parent.
  - `mj-social-element` → ensures `mj-social` parent.
  - `mj-carousel-image` → ensures `mj-carousel` parent.
  - `mj-accordion-title/text/element` → ensures `mj-accordion` and `mj-accordion-element`.

This keeps the element tree valid per MJML spec and prevents broken documents.

## Preview & Import Modals
- `EnhancedPreviewModal.tsx`:
  - Props: `isOpen`, `onClose`, `elements`, `templateName?`, `onConfirm?`, `confirmLabel?`.
  - Generates MJML from `elements` → converts to HTML.
  - Tabs: Visual (with responsive viewport), MJML, HTML.
  - Keyboard: `Esc` to close; `Ctrl/Cmd+Enter` to confirm when `onConfirm` is provided.
- `ImportMjmlModal.tsx`:
  - Accepts pasted MJML/HTML.
  - Validates and parses into editor `EditorElement[]`.

## Custom Template Preview & Insertion
- `ComponentsPanel.tsx` triggers `onTemplateInsert(templateId)`.
- In `EnhancedMjmlEditor.tsx`:
  - `handleInsertTemplate()` opens preview with selected `TemplateBlock`.
  - `handleConfirmInsertTemplate()`:
    - Deep-clones every element with new IDs (`cloneWithNewIds`).
    - Inserts clones under the first `<mj-body>` found (`findFirstByTagName`).
    - Uses `insertManyUnderParent` to batch insert within a single undoable action.
- Save includes `data.customTemplates` so user-defined blocks persist.

## Utilities (selected)
- `editorElementsToMjmlString(elements)` – serialize to MJML.
- `parseMJMLString(mjml)` – parse MJML → `EditorElement[]`.
- `mjmlToHtml(mjml)` – convert MJML → HTML (for preview and final save).
- `cloneWithNewIds(el)` – deep clone with fresh `id`s to avoid collisions.
- `findFirstByTagName(tree, 'mj-body')` – find insertion point.
- `insertManyUnderParent(tree, parentId, items)` – immutable tree insert.

## Save Flow (Parcelvoy Integration)
- `EnhancedMjmlEditor.tsx` builds updated template on save:
  - `mjml` from `editorElementsToMjmlString(present)`.
  - `html` from `mjmlToHtml(mjml)`.
  - `elements` from current state.
  - `customTemplates` carried forward for persistence.
  - `metadata.savedAt` timestamp updated.
- Parent invokes existing API: `api.templates.update(projectId, templateId, { type, data })`.
- UI feedback via toasts; save button with loading state; `Ctrl+S` shortcut.

## Keyboard Shortcuts
- **Ctrl/Cmd+S**: Save.
- **Ctrl/Cmd+Enter (modal)**: Confirm in `EnhancedPreviewModal` when `onConfirm` is supplied.
- **Standard undo/redo** (e.g., Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z or Ctrl+Y) if wired in the host.

## Adding New Prebuilt Templates
1. Edit `templates/customTemplates.ts` and append a `TemplateBlock`.
2. IDs inside `elements` are placeholders; they will be regenerated on insertion.
3. Provide `name` and optional `description` for the Components panel.

## Adding New Components
- Extend palette in `ComponentsPanel.tsx`.
- Update canvas drop handling in `Canvas.tsx` to enforce MJML constraints and scaffolding if needed.
- Add property editors in the right panel (if applicable).

## Accessibility & UX
- Focus management in modals; Escape closes.
- Buttons have titles/tooltips.
- Clipboard actions show feedback.
- Responsive preview with three viewports.

## Error Handling
- Try/catch around preview generation and insert operations.
- Toast notifications for user-friendly feedback.
- Guards for missing `mjml`/`mj-body` create a default structure when needed.

## Example Flow: Custom Template Insert
1. User clicks a custom template in `ComponentsPanel`.
2. `EnhancedPreviewModal` opens showing Visual/MJML/HTML.
3. User clicks “Insert” (or Ctrl/Cmd+Enter).
4. Editor clones elements with new IDs and inserts under `<mj-body>`.
5. Selection/focus shifts to Layers; success toast shown.

## Example Flow: Save
1. User presses Ctrl/Cmd+S or clicks Save.
2. Editor serializes elements → MJML → HTML.
3. Parent updates via existing API.
4. `savedAt` updated; success toast shown.

---

For questions or enhancements, see:
- `EnhancedMjmlEditor.tsx`
- `components/EnhancedPreviewModal.tsx`
- `components/ImportMjmlModal.tsx`
- `components/Canvas.tsx`
- `components/ComponentsPanel.tsx`
- `templates/customTemplates.ts`
