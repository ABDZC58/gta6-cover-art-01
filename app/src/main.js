// Neon Coast Cover Studio — wires the page.
// Pick photos (file picker or drag & drop), choose a layout and a sunset
// grade, letter the caption, drag any panel to crop it, then export a PNG
// in square, portrait, wide or story size — all on the machine, no upload.

import {
  COVER_SIZES, COVER_GRADES, COVER_LAYOUTS, drawCoverArt, renderCoverCanvas,
  layoutPanels, defaultCoverState,
} from './cover.js';
import {
  createEditor, cloneCoverState, pushHistory, undoEdit, redoEdit, applyCoverChange,
  selectedPanelSlot, assignPhotoToPanel, fillAllPanelsWithPhoto, zoomSelectedPanel,
  panSelectedPanel, resetSelectedPanelCrop, loadEditorImage, MAX_PHOTOS,
} from './editor.js';
import { runShotScene } from './shots.js';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const status = $('status');
const editor = createEditor();
let currentSize = COVER_SIZES.find((s) => s.id === 'wide');
let fontsReady = false;

function loadedPhotos() {
  return editor.photos;
}

function redraw() {
  preview.width = currentSize.width;
  preview.height = currentSize.height;
  drawCoverArt(preview, editor.state, loadedPhotos());
  updatePanelReadout();
}

function updatePanelReadout() {
  const slot = selectedPanelSlot(editor);
  $('panelReadout').textContent =
    `Panel ${editor.selectedPanel + 1} · photo ${slot.photo + 1} · zoom ${slot.zoom.toFixed(2)}×`;
  $('zoomRange').value = String(slot.zoom);
}

function setStatus(text) {
  status.textContent = text;
}

/** Builds the layout buttons, grade swatches and size buttons. */
export function buildControlRows() {
  const layoutRow = $('layoutRow');
  COVER_LAYOUTS.forEach((layout) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = layout.name;
    button.dataset.layout = layout.id;
    button.addEventListener('click', () => {
      applyCoverChange(editor, (state) => { state.layout = layout.id; });
      editor.selectedPanel = 0;
      syncControlStates();
      redraw();
    });
    layoutRow.appendChild(button);
  });
  const gradeRow = $('gradeRow');
  COVER_GRADES.forEach((grade) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch';
    button.textContent = grade.name;
    button.dataset.grade = grade.id;
    button.style.setProperty('--sw1', grade.title[1]);
    button.style.setProperty('--sw2', grade.title[2]);
    button.addEventListener('click', () => {
      applyCoverChange(editor, (state) => { state.grade = grade.id; });
      syncControlStates();
      redraw();
    });
    gradeRow.appendChild(button);
  });
  const sizeRow = $('sizeRow');
  COVER_SIZES.forEach((size) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = size.label;
    button.dataset.size = size.id;
    button.addEventListener('click', () => {
      currentSize = size;
      syncControlStates();
      redraw();
    });
    sizeRow.appendChild(button);
  });
}

/** Marks the active layout, grade and size buttons. */
export function syncControlStates() {
  document.querySelectorAll('#layoutRow .chip').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === editor.state.layout);
  });
  document.querySelectorAll('#gradeRow .swatch').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === editor.state.grade);
  });
  document.querySelectorAll('#sizeRow .chip').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === currentSize.id);
  });
  $('titleInput').value = editor.state.title;
  $('subtitleInput').value = editor.state.subtitle;
  $('heatRange').value = String(editor.state.heat);
  $('heatValue').textContent = '★'.repeat(editor.state.heat) + '☆'.repeat(5 - editor.state.heat);
  $('grainCheck').checked = editor.state.grain;
  $('vignetteCheck').checked = editor.state.vignette;
  $('undoButton').disabled = !editor.undoStack.length;
  $('redoButton').disabled = !editor.redoStack.length;
}

/** Builds the four photo tray slots and their click-to-assign behaviour. */
export function buildPhotoTray() {
  const tray = $('photoTray');
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'tray-slot';
    slot.dataset.photo = String(i);
    slot.textContent = `Photo ${i + 1}: empty`;
    slot.addEventListener('click', () => {
      editor.selectedPhoto = i;
      if (editor.photos[i]) {
        assignPhotoToPanel(editor, editor.selectedPanel, i);
        redraw();
        setStatus(`Panel ${editor.selectedPanel + 1} now uses photo ${i + 1}.`);
      }
      syncTray();
    });
    tray.appendChild(slot);
  }
}

/** Refreshes the tray labels and thumbnails from the loaded photos. */
export function syncTray() {
  document.querySelectorAll('.tray-slot').forEach((slot, i) => {
    const img = editor.photos[i];
    slot.classList.toggle('filled', Boolean(img));
    slot.classList.toggle('selected', editor.selectedPhoto === i);
    slot.style.backgroundImage = img ? `url(${img.src})` : '';
    slot.textContent = img ? `Photo ${i + 1}` : `Photo ${i + 1}: empty`;
  });
}

/** Adds an uploaded file to the first free tray slot (or replaces slot 1). */
export async function addUploadedPhoto(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const img = await loadEditorImage(file);
  let slot = editor.photos.findIndex((p) => !p);
  if (slot === -1) slot = 0;
  editor.photos[slot] = img;
  editor.selectedPhoto = slot;
  redraw();
  syncTray();
  setStatus(`Loaded ${file.name} into photo ${slot + 1}. Click a panel, then a tray photo, to place it.`);
}

/** Exports the current cover at `size` as a PNG download. */
export function exportCoverPng(size) {
  const canvas = renderCoverCanvas(size, editor.state, loadedPhotos());
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-coast-${size.width}x${size.height}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved neon-coast-${size.width}x${size.height}.png`);
  }, 'image/png');
}

/** Exports every size, one PNG after another. */
export async function exportAllSizes() {
  for (const size of COVER_SIZES) {
    exportCoverPng(size);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

/** Which panel (if any) sits under a click, in fractions of the preview. */
export function panelAtPoint(fx, fy) {
  if (editor.state.layout === 'fullbleed') return 0;
  const { panels } = layoutPanels(editor.state.layout, 1, 1);
  const titleTop = editor.state.layout === 'fullbleed' ? 1 : 1 - (preview.height >= preview.width ? 0.22 : 0.26);
  if (fy >= titleTop) return -1;
  for (let i = 0; i < panels.length; i++) {
    const r = panels[i];
    if (fx >= r.x && fx <= r.x + r.w && fy >= r.y && fy <= r.y + r.h) return i;
  }
  return -1;
}

function wireCanvasPointer() {
  let dragging = false;
  let lastX = 0, lastY = 0;
  let moved = false;
  preview.addEventListener('pointerdown', (e) => {
    const rect = preview.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const hit = panelAtPoint(fx, fy);
    if (hit < 0) return;
    editor.selectedPanel = hit;
    dragging = true;
    moved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    preview.setPointerCapture(e.pointerId);
    redraw();
  });
  preview.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = preview.getBoundingClientRect();
    const dx = (e.clientX - lastX) / rect.width;
    const dy = (e.clientY - lastY) / rect.height;
    if (Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY) > 2) moved = true;
    lastX = e.clientX;
    lastY = e.clientY;
    panSelectedPanel(editor, dx, dy);
    redraw();
  });
  preview.addEventListener('pointerup', () => {
    if (dragging && moved) pushHistory(editor);
    dragging = false;
  });
  preview.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomSelectedPanel(editor, e.deltaY < 0 ? 1.08 : 1 / 1.08);
    redraw();
  }, { passive: false });
}

function wireControls() {
  $('photoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await addUploadedPhoto(file);
    e.target.value = '';
  });
  $('fillAllButton').addEventListener('click', () => {
    fillAllPanelsWithPhoto(editor, editor.selectedPhoto);
    redraw();
    setStatus(`All panels now use photo ${editor.selectedPhoto + 1}.`);
  });
  $('resetCropButton').addEventListener('click', () => {
    resetSelectedPanelCrop(editor);
    redraw();
  });
  $('zoomRange').addEventListener('input', (e) => {
    const slot = selectedPanelSlot(editor);
    slot.zoom = Number(e.target.value);
    redraw();
  });
  $('titleInput').addEventListener('input', (e) => {
    editor.state.title = e.target.value;
    redraw();
  });
  $('subtitleInput').addEventListener('input', (e) => {
    editor.state.subtitle = e.target.value;
    redraw();
  });
  $('heatRange').addEventListener('input', (e) => {
    editor.state.heat = Number(e.target.value);
    syncControlStates();
    redraw();
  });
  $('grainCheck').addEventListener('change', (e) => {
    editor.state.grain = e.target.checked;
    redraw();
  });
  $('vignetteCheck').addEventListener('change', (e) => {
    editor.state.vignette = e.target.checked;
    redraw();
  });
  $('undoButton').addEventListener('click', () => {
    if (undoEdit(editor)) { syncControlStates(); redraw(); }
  });
  $('redoButton').addEventListener('click', () => {
    if (redoEdit(editor)) { syncControlStates(); redraw(); }
  });
  $('exportButton').addEventListener('click', () => exportCoverPng(currentSize));
  $('exportAllButton').addEventListener('click', exportAllSizes);
  ['titleInput', 'subtitleInput', 'heatRange'].forEach((id) => {
    $(id).addEventListener('change', () => pushHistory(editor));
  });
  const dropZone = $('dropZone');
  ['dragover', 'dragenter'].forEach((name) => dropZone.addEventListener(name, (e) => {
    e.preventDefault();
    dropZone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragging');
  }));
  dropZone.addEventListener('drop', async (e) => {
    await addUploadedPhoto(e.dataTransfer.files[0]);
  });
  preview.addEventListener('dragover', (e) => e.preventDefault());
  preview.addEventListener('drop', async (e) => {
    e.preventDefault();
    await addUploadedPhoto(e.dataTransfer.files[0]);
  });
}

/** Loads the two demo photos into the tray so the app opens ready to play. */
export async function loadDemoPhotos() {
  const first = await loadEditorImage('samples/boulevard.jpg').catch(() => null);
  const second = await loadEditorImage('samples/pier.jpg').catch(() => null);
  if (first) editor.photos[0] = first;
  if (second) editor.photos[1] = second;
  syncTray();
}

/** Waits for Anton, Pacifico and Bebas Neue, then redraws crisply. */
export async function waitForCoverFonts() {
  try {
    await Promise.all([
      document.fonts.load('40px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.load('40px "Bebas Neue"'),
    ]);
    fontsReady = true;
    await document.fonts.ready;
  } catch {
    fontsReady = false;
  }
  redraw();
}

buildControlRows();
buildPhotoTray();
wireControls();
wireCanvasPointer();
syncControlStates();

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShotScene(shot, new URLSearchParams(location.search), async (scene) => {
    await waitForCoverFonts();
    await loadDemoPhotos();
    const size = COVER_SIZES.find((s) => s.id === scene.size) ?? currentSize;
    const first = await loadEditorImage(`samples/${scene.photo}.jpg`).catch(() => null);
    const second = await loadEditorImage(`samples/${scene.photo2}.jpg`).catch(() => null);
    if (first) editor.photos[0] = first;
    if (second) editor.photos[1] = second;
    editor.state = {
      ...cloneCoverState(defaultCoverState()),
      layout: scene.layout,
      grade: scene.grade,
      title: scene.title,
      subtitle: scene.subtitle,
      heat: scene.heat,
    };
    currentSize = size;
    syncTray();
    syncControlStates();
    redraw();
  });
} else {
  loadDemoPhotos().then(() => waitForCoverFonts()).then(redraw);
}
