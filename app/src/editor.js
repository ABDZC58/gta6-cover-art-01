// Neon Coast Cover Studio — editor state.
// Holds the cover state, the photo tray, the selected panel, and an
// undo/redo history of every change, so any edit can be taken back.

import { defaultCoverState } from './cover.js';

/** The photo tray holds up to four photos, each an image or null. */
export const MAX_PHOTOS = 4;

/** Deep-clones a cover state (plain JSON data only). */
export function cloneCoverState(state) {
  return JSON.parse(JSON.stringify(state));
}

/** Creates a fresh editor: default cover, empty tray, undo/redo stacks. */
export function createEditor() {
  return {
    state: defaultCoverState(),
    photos: [null, null, null, null],
    selectedPanel: 0,
    selectedPhoto: 0,
    undoStack: [],
    redoStack: [],
  };
}

/** Pushes the current state onto the undo stack and clears redo. */
export function pushHistory(editor) {
  editor.undoStack.push(cloneCoverState(editor.state));
  if (editor.undoStack.length > 60) editor.undoStack.shift();
  editor.redoStack = [];
}

/** Undoes one step; returns true when something changed. */
export function undoEdit(editor) {
  if (!editor.undoStack.length) return false;
  editor.redoStack.push(cloneCoverState(editor.state));
  editor.state = editor.undoStack.pop();
  return true;
}

/** Redoes one undone step; returns true when something changed. */
export function redoEdit(editor) {
  if (!editor.redoStack.length) return false;
  editor.undoStack.push(cloneCoverState(editor.state));
  editor.state = editor.redoStack.pop();
  return true;
}

/** Applies a change to the state through history (one undoable step). */
export function applyCoverChange(editor, mutate) {
  pushHistory(editor);
  mutate(editor.state);
}

/** The panel slot the editor is pointing at, clamped to the layout. */
export function selectedPanelSlot(editor) {
  return editor.state.panels[editor.selectedPanel] ?? editor.state.panels[0];
}

/** Assigns a tray photo to a panel (one undoable step). */
export function assignPhotoToPanel(editor, panelIndex, photoIndex) {
  applyCoverChange(editor, (state) => {
    state.panels[panelIndex].photo = photoIndex;
  });
}

/** Fills every panel with the same tray photo (one undoable step). */
export function fillAllPanelsWithPhoto(editor, photoIndex) {
  applyCoverChange(editor, (state) => {
    state.panels.forEach((slot) => { slot.photo = photoIndex; });
  });
}

/** Zooms the selected panel in or out, clamped to 1–3x. */
export function zoomSelectedPanel(editor, factor) {
  const slot = selectedPanelSlot(editor);
  slot.zoom = Math.min(3, Math.max(1, slot.zoom * factor));
}

/** Pans the selected panel's photo by fractions of the panel. */
export function panSelectedPanel(editor, dx, dy) {
  const slot = selectedPanelSlot(editor);
  slot.ox = Math.min(0.6, Math.max(-0.6, slot.ox + dx));
  slot.oy = Math.min(0.6, Math.max(-0.6, slot.oy + dy));
}

/** Resets the selected panel's crop to fill (one undoable step). */
export function resetSelectedPanelCrop(editor) {
  applyCoverChange(editor, (state) => {
    const slot = state.panels[editor.selectedPanel];
    slot.zoom = 1;
    slot.ox = 0;
    slot.oy = 0;
  });
}

/** Loads an image from a File or a URL, resolving once it can be drawn. */
export function loadEditorImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load image'));
    img.src = source instanceof File ? URL.createObjectURL(source) : source;
  });
}
