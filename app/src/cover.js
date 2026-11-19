// Neon Coast Cover Studio — the cover renderer.
// Draws GTA-poster-style multi-panel cover art onto a 2D canvas: inked photo
// panels, a synthwave sunset (slitted sun, palm silhouettes), a halftone title
// block with gradient Anton lettering and a neon Pacifico subtitle, a heat
// meter, a badge ribbon, film grain and a vignette. Every colour grade is
// applied with canvas blend modes, so any photo gets the sunset/neon grade.

/** The export sizes: square, portrait, wide and story. */
export const COVER_SIZES = [
  { id: 'square', label: 'Square 1080 × 1080', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Portrait 1080 × 1350', width: 1080, height: 1350 },
  { id: 'wide', label: 'Wide 1920 × 1080', width: 1920, height: 1080 },
  { id: 'story', label: 'Story 1080 × 1920', width: 1080, height: 1920 },
];

/** Six sunset / neon grades. `wash` is laid over each photo with soft-light. */
export const COVER_GRADES = [
  {
    id: 'vice', name: 'Vice Sunset', sky: ['#2b1055', '#ff6a3d'],
    wash: '#ff5e8a', title: ['#ffe259', '#ff7e3d', '#ff2e88'], accent: '#2de2ff', sub: '#ffd6f2',
  },
  {
    id: 'neon', name: 'Neon Nights', sky: ['#0b1035', '#c400ff'],
    wash: '#00e5ff', title: ['#7df9ff', '#ff5ce1', '#8a2bff'], accent: '#ffea00', sub: '#c8fff4',
  },
  {
    id: 'golden', name: 'Golden Hour', sky: ['#3a1c00', '#ffb347'],
    wash: '#ff9d00', title: ['#fff3a3', '#ffb347', '#ff5e3a'], accent: '#ff5e8a', sub: '#fff0c8',
  },
  {
    id: 'teal', name: 'Palm Teal', sky: ['#04263b', '#00b4a2'],
    wash: '#ff8a3d', title: ['#d8fff4', '#2de2c5', '#ff7e3d'], accent: '#ff5e8a', sub: '#eafffb',
  },
  {
    id: 'hotpink', name: 'Hot Pink', sky: ['#2d0036', '#ff2e88'],
    wash: '#ff2e88', title: ['#ffd6f2', '#ff5ce1', '#ff2e88'], accent: '#2de2ff', sub: '#ffe9f6',
  },
  {
    id: 'midnight', name: 'Midnight', sky: ['#050514', '#3d2bff'],
    wash: '#5a6cff', title: ['#c8d4ff', '#7d8cff', '#c400ff'], accent: '#ff5ce1', sub: '#e6e9ff',
  },
];

/** Five layouts. Each returns panel rects (fractions of W/H) and the title band. */
export const COVER_LAYOUTS = [
  { id: 'nine', name: 'Nine-Panel Grid', panels: 9 },
  { id: 'hero', name: 'Hero + Three', panels: 4 },
  { id: 'fullbleed', name: 'Full-Bleed', panels: 1 },
  { id: 'tilted', name: 'Tilted Snapshots', panels: 3 },
  { id: 'six', name: 'Six-Panel Grid', panels: 6 },
];

/** Panel rectangles for a layout, in fractions of the cover (x, y, w, h, rot). */
export function layoutPanels(layoutId, width, height) {
  const gap = 0.012;
  const titleH = layoutId === 'fullbleed' ? 0 : (height >= width ? 0.22 : 0.26);
  const top = 0.0;
  const gridH = 1 - titleH;
  const cell = (cols, rows, x0, y0, w0, h0) => {
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({
          x: x0 + (c * w0) / cols, y: y0 + (r * h0) / rows,
          w: w0 / cols, h: h0 / rows, rot: 0,
        });
      }
    }
    return out;
  };
  let panels;
  if (layoutId === 'nine') panels = cell(3, 3, 0, top, 1, gridH);
  else if (layoutId === 'six') panels = cell(2, 3, 0, top, 1, gridH);
  else if (layoutId === 'hero') {
    panels = [{ x: 0, y: top, w: 0.62, h: gridH, rot: 0 }];
    for (let i = 0; i < 3; i++) {
      panels.push({ x: 0.62, y: top + (i * gridH) / 3, w: 0.38, h: gridH / 3, rot: 0 });
    }
  } else if (layoutId === 'tilted') {
    panels = [
      { x: 0.04, y: 0.06, w: 0.44, h: gridH * 0.62, rot: -0.07 },
      { x: 0.52, y: 0.10, w: 0.44, h: gridH * 0.62, rot: 0.06 },
      { x: 0.28, y: 0.42, w: 0.44, h: gridH * 0.55, rot: -0.015 },
    ];
  } else panels = [{ x: 0, y: 0, w: 1, h: 1, rot: 0 }]; // fullbleed
  return { panels, titleBand: { x: 0, y: gridH, w: 1, h: titleH }, gap };
}

/** A fresh default cover state (nine panels, each with a photo slot). */
export function defaultCoverState() {
  return {
    layout: 'nine',
    grade: 'vice',
    title: 'NEON COAST',
    subtitle: 'sunset heist',
    heat: 4,
    grain: true,
    vignette: true,
    panels: Array.from({ length: 9 }, (_, i) => ({ photo: i % 2, zoom: 1, ox: 0, oy: 0.35 })),
  };
}

function gradeById(id) {
  return COVER_GRADES.find((g) => g.id === id) ?? COVER_GRADES[0];
}

/** Cover-fits `img` into rect `r` (fractions of W/H), honouring zoom and pan.
 * The pan is clamped so the photo always covers the panel — a wide panel
 * showing a tall photo has no vertical slack to spend. */
export function drawFittedPhoto(ctx, img, r, width, height, zoom, ox, oy) {
  const px = r.x * width, py = r.y * height, pw = r.w * width, ph = r.h * height;
  const scale = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  let cx = px + pw / 2 + ox * pw, cy = py + ph / 2 + oy * ph;
  if (dw >= pw) cx = Math.min(Math.max(cx, px + pw - dw / 2), px + dw / 2);
  else cx = px + pw / 2;
  if (dh >= ph) cy = Math.min(Math.max(cy, py + ph - dh / 2), py + dh / 2);
  else cy = py + ph / 2;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
}

/** Lays the grade wash and a sunset gradient over one panel, then inks it. */
export function gradeAndInkPanel(ctx, r, width, height, grade) {
  const px = r.x * width, py = r.y * height, pw = r.w * width, ph = r.h * height;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grade.wash;
  ctx.fillRect(px, py, pw, ph);
  ctx.globalCompositeOperation = 'overlay';
  const g = ctx.createLinearGradient(px, py, px, py + ph);
  g.addColorStop(0, 'rgba(255,190,80,0)');
  g.addColorStop(1, 'rgba(255,46,136,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();
  const ink = Math.max(4, width * 0.006);
  ctx.lineWidth = ink;
  ctx.strokeStyle = '#12041f';
  ctx.strokeRect(px + ink / 2, py + ink / 2, pw - ink, ph - ink);
  ctx.lineWidth = Math.max(1.5, width * 0.0016);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeRect(px + ink + 2, py + ink + 2, pw - 2 * ink - 4, ph - 2 * ink - 4);
}

/** Mixes two #rrggbb colours by t (0..1). */
export function mixHexColor(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mixed = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** A retro slitted sunset sun, drawn centred on (cx, cy) with radius `rad`. */
export function drawSunsetSun(ctx, cx, cy, rad, grade, slitColor) {
  ctx.save();
  const g = ctx.createLinearGradient(cx, cy - rad, cx, cy + rad);
  g.addColorStop(0, grade.title[0]);
  g.addColorStop(0.55, grade.title[1]);
  g.addColorStop(1, grade.title[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = slitColor;
  let y = cy + rad * 0.08, h = rad * 0.045;
  while (y < cy + rad) { ctx.fillRect(cx - rad, y, rad * 2, h); y += h * 2.6; h *= 1.35; }
  ctx.restore();
}

/** A simple palm silhouette: curved trunk, five drooping fronds. */
export function drawPalmSilhouette(ctx, x, y, size, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(lean, 1);
  ctx.strokeStyle = 'rgba(16,4,32,0.92)';
  ctx.lineCap = 'round';
  ctx.lineWidth = size * 0.045;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.06, -size * 0.5, size * 0.22, -size * 0.88);
  ctx.stroke();
  ctx.lineWidth = size * 0.05;
  const topX = size * 0.22, topY = -size * 0.88;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.08 + i * 0.19);
    const ex = topX + Math.cos(a) * size * 0.52;
    const ey = topY + Math.sin(a) * size * 0.34 + size * 0.12;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * size * 0.3, topY - size * 0.12, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

/** Halftone dots across the title band, growing toward its foot. */
export function drawHalftoneTitleBlock(ctx, band, width, height, grade) {
  const bx = band.x * width, by = band.y * height, bw = band.w * width, bh = band.h * height;
  const sky = ctx.createLinearGradient(0, by, 0, by + bh);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(1, grade.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = grade.accent;
  ctx.globalAlpha = 0.28;
  const step = Math.max(14, width * 0.016);
  for (let y = by + step * 0.7, row = 0; y < by + bh; y += step, row++) {
    const rad = 1.2 + (y - by) / bh * (step * 0.24);
    for (let x = bx + (row % 2 ? step / 2 : 0) + step * 0.4; x < bx + bw; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(bx, by, bw, Math.max(3, height * 0.004));
}

let grainTile = null;
/** A reusable film-grain tile, drawn with overlay at low alpha. */
export function grainPattern(ctx, width, height) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 140;
    grainTile.height = 140;
    const g = grainTile.getContext('2d');
    const data = g.createImageData(140, 140);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = 96 + Math.floor(Math.random() * 64);
      data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
    }
    g.putImageData(data, 0, 0);
  }
  const pattern = ctx.createPattern(grainTile, 'repeat');
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** Darkens the corners so the centre pops. */
export function drawVignette(ctx, width, height) {
  const g = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.42,
    width / 2, height / 2, Math.max(width, height) * 0.75,
  );
  g.addColorStop(0, 'rgba(10,0,24,0)');
  g.addColorStop(1, 'rgba(10,0,24,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

/** Fits `text` in Anton at the largest size whose width stays under `maxW`. */
export function fitAntonTitle(ctx, text, maxW, startSize, fontFamily) {
  let size = startSize;
  ctx.font = `${size}px ${fontFamily}`;
  while (size > 12 && ctx.measureText(text).width > maxW) {
    size = Math.max(12, size - 4);
    ctx.font = `${size}px ${fontFamily}`;
  }
  return size;
}

/** The badge ribbon: a slanted strip in the top-right corner with the heat. */
export function drawBadgeRibbon(ctx, width, height, grade, heat) {
  const stars = '★'.repeat(heat) + '☆'.repeat(5 - heat);
  const label = `HEAT ${stars}`;
  ctx.save();
  const size = Math.max(20, width * 0.02);
  ctx.font = `${size}px "Bebas Neue", sans-serif`;
  const tw = ctx.measureText(label).width + size * 1.6;
  const th = size * 1.7;
  ctx.translate(width - tw / 2 - width * 0.015, th * 0.75);
  ctx.rotate(0.045);
  ctx.fillStyle = grade.accent;
  ctx.strokeStyle = '#12041f';
  ctx.lineWidth = Math.max(2, width * 0.002);
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -th / 2, tw, th, th / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#12041f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, size * 0.05);
  ctx.restore();
}

/**
 * Draws the whole cover onto `canvas` at its own size.
 * `state` is a cover state, `photos` an array of images (or nulls).
 */
export function drawCoverArt(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  const grade = gradeById(state.grade);
  const { panels, titleBand } = layoutPanels(state.layout, width, height);
  const gap = width * 0.012;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(1, grade.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  if (state.layout === 'tilted') {
    drawSunsetSun(ctx, width * 0.5, height * 0.34, Math.min(width, height) * 0.26, grade,
      mixHexColor(grade.sky[0], grade.sky[1], 0.4));
  }
  if (state.layout === 'fullbleed') {
    const img = photos[state.panels[0]?.photo ?? 0];
    if (img) drawFittedPhoto(ctx, img, { x: 0, y: 0, w: 1, h: 1 }, width, height, state.panels[0].zoom, state.panels[0].ox, state.panels[0].oy);
    else ctx.fillStyle = grade.sky[0], ctx.fillRect(0, 0, width, height);
    const wash = ctx.createLinearGradient(0, height * 0.35, 0, height);
    wash.addColorStop(0, 'rgba(20,4,40,0)');
    wash.addColorStop(1, 'rgba(20,4,40,0.72)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);
  } else {
    panels.forEach((r, i) => {
      const slot = state.panels[i] ?? { photo: 0, zoom: 1, ox: 0, oy: 0 };
      const img = photos[slot.photo];
      ctx.save();
      if (r.rot) {
        ctx.translate((r.x + r.w / 2) * width, (r.y + r.h / 2) * height);
        ctx.rotate(r.rot);
        ctx.translate(-(r.x + r.w / 2) * width, -(r.y + r.h / 2) * height);
      }
      const px = r.x * width + gap / 2, py = r.y * height + gap / 2;
      const pw = r.w * width - gap, ph = r.h * height - gap;
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();
      if (img) drawFittedPhoto(ctx, img, { x: px / width, y: py / height, w: pw / width, h: ph / height }, width, height, slot.zoom, slot.ox, slot.oy);
      else { ctx.fillStyle = '#3a1c5e'; ctx.fillRect(px, py, pw, ph); }
      gradeAndInkPanel(ctx, { x: px / width, y: py / height, w: pw / width, h: ph / height }, width, height, grade);
      ctx.restore();
    });
  }

  if (state.layout !== 'fullbleed') {
    drawHalftoneTitleBlock(ctx, titleBand, width, height, grade);
    const by = titleBand.y * height, bh = titleBand.h * height;
    const sunR = bh * 0.55;
    drawSunsetSun(ctx, width * 0.5, by + bh * 0.18, sunR, grade,
      mixHexColor(grade.sky[0], grade.sky[1], 0.85));
    drawPalmSilhouette(ctx, width * 0.055, by + bh * 0.98, bh * 0.85, 1);
    drawPalmSilhouette(ctx, width * 0.945, by + bh * 0.98, bh * 0.72, -1);
  } else {
    drawSunsetSun(ctx, width * 0.82, height * 0.22, Math.min(width, height) * 0.13, grade, 'rgba(20,4,40,0.85)');
  }

  // Title lettering: gradient Anton capitals, outlined; neon Pacifico subtitle.
  const title = (state.title || 'NEON COAST').trim().toUpperCase();
  const bandY = state.layout === 'fullbleed' ? height * 0.68 : titleBand.y * height;
  const bandH = state.layout === 'fullbleed' ? height * 0.3 : titleBand.h * height;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleSize = fitAntonTitle(ctx, title, width * 0.9, bandH * 0.52, 'Anton, sans-serif');
  const tg = ctx.createLinearGradient(0, bandY + bandH * 0.18, 0, bandY + bandH * 0.62);
  tg.addColorStop(0, grade.title[0]);
  tg.addColorStop(0.5, grade.title[1]);
  tg.addColorStop(1, grade.title[2]);
  ctx.font = `${titleSize}px Anton, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, titleSize * 0.07);
  ctx.strokeStyle = '#14041f';
  ctx.strokeText(title, width / 2, bandY + bandH * 0.4);
  ctx.fillStyle = tg;
  ctx.fillText(title, width / 2, bandY + bandH * 0.4);

  const subtitle = (state.subtitle || '').trim();
  if (subtitle) {
    const subSize = Math.max(18, bandH * 0.2);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = subSize * 0.7;
    ctx.fillStyle = grade.sub;
    ctx.fillText(subtitle, width / 2, bandY + bandH * 0.78);
    ctx.shadowBlur = 0;
  }

  drawBadgeRibbon(ctx, width, height, grade, state.heat);
  if (state.grain) grainPattern(ctx, width, height);
  if (state.vignette) drawVignette(ctx, width, height);
}

/** Renders a cover at export size and returns the canvas. */
export function renderCoverCanvas(size, state, photos) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  drawCoverArt(canvas, state, photos);
  return canvas;
}
