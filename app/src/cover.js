// Neon Shore cover engine: draws GTA-style multi-panel cover art on a 2D canvas.
// Everything is drawn in code — no Rockstar logo, artwork or font anywhere. The
// lettering is Anton (display) and Pacifico (script), both SIL OFL fonts vendored
// under app/fonts/. Photos come from the user; every panel also has a procedural
// illustrated fallback scene, so the cover is complete even before a photo loads.
// All drawing is resolution-independent: renderCover(state, w, h) draws the same
// composition at any export size (1080x1080, 1080x1350, 1920x1080).

export const GRADES = {
  sunset: {
    label: 'Sunset',
    sky: ['#2b1055', '#e85d75', '#feb47b'],
    sun: '#ffe9a8',
    tintTop: 'rgba(255,110,60,0.16)', tintBottom: 'rgba(190,30,110,0.34)',
    title: ['#ffffff', '#ffd166'], accent: '#ff2e93', ink: '#1c1030',
    filter: 'saturate(1.25) contrast(1.06)',
  },
  neon: {
    label: 'Neon Nights',
    sky: ['#0b0620', '#3b1d7a', '#ff2e93'],
    sun: '#7df9ff',
    tintTop: 'rgba(255,46,147,0.20)', tintBottom: 'rgba(45,226,255,0.26)',
    title: ['#ffffff', '#7df9ff'], accent: '#2ee2ff', ink: '#12082e',
    filter: 'saturate(1.35) contrast(1.08)',
  },
  vice: {
    label: 'Vice',
    sky: ['#1d0b38', '#8e2a9e', '#19c3d6'],
    sun: '#ffe9a8',
    tintTop: 'rgba(142,42,158,0.20)', tintBottom: 'rgba(25,195,214,0.24)',
    title: ['#ffffff', '#19c3d6'], accent: '#ff9de2', ink: '#160a30',
    filter: 'saturate(1.2) contrast(1.05)',
  },
  gold: {
    label: 'Golden Hour',
    sky: ['#3a1c10', '#c96f2e', '#ffc46b'],
    sun: '#fff3c4',
    tintTop: 'rgba(255,170,60,0.14)', tintBottom: 'rgba(160,60,10,0.30)',
    title: ['#fffbe8', '#ffc46b'], accent: '#ff8c42', ink: '#2a1408',
    filter: 'sepia(0.22) saturate(1.3) contrast(1.05)',
  },
  noir: {
    label: 'Noir',
    sky: ['#0c0c10', '#3a3a44', '#8a8a96'],
    sun: '#f2f2f2',
    tintTop: 'rgba(0,0,0,0.10)', tintBottom: 'rgba(0,0,0,0.28)',
    title: ['#ffffff', '#d8d8d8'], accent: '#ffffff', ink: '#0c0c10',
    filter: 'grayscale(1) contrast(1.18) brightness(1.02)',
  },
};

export const LAYOUTS = {
  nine: { label: 'Nine-Panel Cover', panels: 8 },
  hero: { label: 'Hero + Three', panels: 4 },
  full: { label: 'Full Bleed', panels: 1 },
  tilt: { label: 'Tilted Snapshots', panels: 3 },
};

export const SIZES = {
  square: { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
};

/** A fresh editor state: three photo slots, eight panel crops, sensible defaults. */
export function defaultState() {
  return {
    photos: [null, null, null],
    layout: 'nine',
    grade: 'sunset',
    title: 'NEON SHORE',
    subtitle: 'chase the sunset',
    badge: 'LEONIDA',
    size: 'square',
    // A little deterministic variety per panel, so the same photo in two panels
    // never crops identically.
    panels: Array.from({ length: 8 }, (_, i) => ({
      photo: i % 3,
      zoom: 1 + (i % 3) * 0.12,
      px: (((i * 37) % 10) - 5) / 40,
      py: (((i * 53) % 10) - 5) / 40,
    })),
  };
}

/** Deterministic PRNG (mulberry32) so grain and skylines look the same every draw. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A vertical sky gradient across rect (x, y, w, h) from the grade's sky stops. */
export function drawSky(ctx, x, y, w, h, grade) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  grade.sky.forEach((c, i) => g.addColorStop(i / (grade.sky.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** A glowing sun: radial halo plus a solid disc. */
export function drawSun(ctx, cx, cy, r, color) {
  const halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.6);
  halo.addColorStop(0, color);
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 2.6, cy - r * 2.6, r * 5.2, r * 5.2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A dusk skyline silhouette with lit windows, seeded so it never changes shape. */
export function drawSkyline(ctx, x, y, w, h, color, seed) {
  const rnd = mulberry32(seed);
  ctx.fillStyle = color;
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.05 + rnd() * 0.09);
    const bh = h * (0.35 + rnd() * 0.65);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    if (rnd() < 0.45) ctx.fillRect(bx + bw * 0.3, y + h - bh - h * 0.09, bw * 0.32, h * 0.09);
    const cols = Math.max(1, Math.floor(bw / (w * 0.018)));
    const rows = Math.max(1, Math.floor(bh / (h * 0.09)));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rnd() < 0.32) {
          ctx.fillStyle = rnd() < 0.7 ? '#ffcd6e' : '#8cf0ff';
          ctx.fillRect(bx + w * 0.008 + c * (w * 0.018), y + h - bh + h * 0.03 + r * (h * 0.09), w * 0.008, h * 0.035);
          ctx.fillStyle = color;
        }
      }
    }
    bx += bw + w * 0.008;
  }
}

/** A palm silhouette: curved trunk plus seven drooping fronds. */
export function drawPalm(ctx, x, y, s, color, lean) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  const topX = x + lean * s;
  const topY = y - 1.02 * s;
  ctx.lineWidth = Math.max(2, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * s * 0.4, y - s * 0.55, topX, topY);
  ctx.stroke();
  for (let k = 0; k < 7; k++) {
    const dir = k % 2 === 0 ? 1 : -1;
    const ang = Math.PI * (0.10 + 0.12 * k);
    const ex = topX + dir * Math.cos(ang) * 0.60 * s;
    const ey = topY - Math.sin(ang) * 0.40 * s;
    const cx = topX + dir * Math.cos(ang) * 0.30 * s;
    const cy = topY - s * 0.30;
    ctx.lineWidth = Math.max(2, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(cx, cy, ex, ey + s * 0.10);
    ctx.stroke();
  }
}

/** Halftone dots over a rect: rows of dots that grow toward the bottom edge. */
export function drawHalftone(ctx, x, y, w, h, color, maxR, gap, alpha) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const rows = Math.max(2, Math.floor(h / gap));
  for (let r = 0; r < rows; r++) {
    const cy = y + (r + 0.5) * (h / rows);
    const rr = maxR * (0.25 + 0.75 * (r / Math.max(1, rows - 1)));
    for (let cx = x + gap / 2 + (r % 2) * gap / 2; cx < x + w; cx += gap) {
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Film grain: seeded speckles, the same on every draw. */
export function drawGrain(ctx, w, h, seed, amount) {
  const rnd = mulberry32(seed);
  const n = Math.floor(w * h * amount);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.05 + rnd() * 0.10;
    const s = 1 + rnd() * 2;
    ctx.fillRect(rnd() * w, rnd() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

/** A soft dark vignette around the frame edges. */
export function drawVignette(ctx, w, h, strength) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Cover-fits a photo into rect, honouring the panel's zoom and pan (fractions of rect). */
export function drawPhotoInto(ctx, photo, rect, panel, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (photo) {
    const iw = photo.naturalWidth || photo.width;
    const ih = photo.naturalHeight || photo.height;
    const scale = Math.max(w / iw, h / ih) * (panel.zoom || 1);
    const pw = iw * scale;
    const ph = ih * scale;
    // Pan is clamped so the photo always covers the panel: at zoom 1 there is
    // no room to pan at all, and the slack grows with the zoom.
    const maxPx = Math.max(0, (pw - w) / 2 / w);
    const maxPy = Math.max(0, (ph - h) / 2 / h);
    const px = Math.max(-maxPx, Math.min(maxPx, panel.px || 0));
    const py = Math.max(-maxPy, Math.min(maxPy, panel.py || 0));
    const dx = x + (w - pw) / 2 + px * w;
    const dy = y + (h - ph) / 2 + py * h;
    ctx.filter = grade.filter;
    ctx.drawImage(photo, dx, dy, pw, ph);
    ctx.filter = 'none';
  } else {
    drawFallbackScene(ctx, rect, grade, panel.seed || 1);
  }
  // Grade wash: warm top, deep bottom, so every photo reads as one poster.
  const tint = ctx.createLinearGradient(x, y, x, y + h);
  tint.addColorStop(0, grade.tintTop);
  tint.addColorStop(1, grade.tintBottom);
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, w, h);
  // A faint inner frame so panels read as separate shots.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();
}

/** The illustrated scene behind a panel with no photo yet: sky, sun, skyline, palms. */
export function drawFallbackScene(ctx, rect, grade, seed) {
  const { x, y, w, h } = rect;
  drawSky(ctx, x, y, w, h, grade);
  drawSun(ctx, x + w * (0.3 + 0.4 * ((seed * 37) % 10) / 10), y + h * 0.34, Math.min(w, h) * 0.13, grade.sun);
  drawSkyline(ctx, x, y + h * 0.55, w, h * 0.45, grade.ink, seed * 101 + 7);
  drawPalm(ctx, x + w * 0.08, y + h, h * 0.42, grade.ink, 0.3);
  drawPalm(ctx, x + w * 0.94, y + h, h * 0.34, grade.ink, -0.3);
}

/** A white guttered panel grid for the nine-panel cover: 8 photo rects + centre title. */
export function ninePanelRects(w, h) {
  const m = Math.min(w, h) * 0.018;
  const g = Math.min(w, h) * 0.012;
  const cellW = (w - 2 * m - 2 * g) / 3;
  const cellH = (h - 2 * m - 2 * g) / 3;
  const rects = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 1 && col === 1) continue;
      rects.push({ x: m + col * (cellW + g), y: m + row * (cellH + g), w: cellW, h: cellH });
    }
  }
  const title = { x: m + cellW + g, y: m + cellH + g, w: cellW, h: cellH };
  return { rects, title };
}

/** Fits display type to maxW: shrinks the Anton size until the line fits. */
export function fitAnton(ctx, text, maxW, size, weight) {
  let s = size;
  ctx.font = `${weight} ${s}px Anton, "Arial Black", sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, s * 0.02)}px`; } catch { /* older canvas */ }
  while (ctx.measureText(text).width > maxW && s > 10) {
    s -= 2;
    ctx.font = `${weight} ${s}px Anton, "Arial Black", sans-serif`;
  }
  return s;
}

/** The poster's big title: gradient-filled Anton capitals with a dark outline. */
export function drawTitleText(ctx, text, cx, baselineY, maxW, size, grade, align = 'center') {
  const s = fitAnton(ctx, text, maxW, size, 400);
  const grad = ctx.createLinearGradient(0, baselineY - s, 0, baselineY + s * 0.12);
  grad.addColorStop(0, grade.title[0]);
  grad.addColorStop(1, grade.title[1]);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = grade.ink;
  ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.strokeText(text, cx, baselineY);
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, baselineY);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  return s;
}

/** The neon script subtitle in Pacifico, with a soft glow. */
export function drawSubtitle(ctx, text, cx, y, maxW, size, grade, align = 'center') {
  let s = size;
  ctx.font = `${s}px Pacifico, cursive`;
  while (ctx.measureText(text).width > maxW && s > 10) {
    s -= 2;
    ctx.font = `${s}px Pacifico, cursive`;
  }
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = grade.accent;
  ctx.shadowBlur = s * 0.45;
  ctx.fillStyle = grade.accent;
  ctx.fillText(text, cx, y);
  ctx.shadowBlur = 0;
  return s;
}

/** A small pill badge: five stars and a word, like a heat meter on a poster. */
export function drawBadge(ctx, text, cx, y, w, grade) {
  const h = w * 0.16;
  ctx.save();
  ctx.translate(cx, y);
  ctx.fillStyle = grade.ink;
  ctx.globalAlpha = 0.88;
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = Math.max(1.5, w * 0.008);
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.stroke();
  ctx.fillStyle = grade.accent;
  ctx.font = `${h * 0.52}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`★ ★ ★ ★ ★  ${text}`, 0, h * 0.04);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The centre title block of the nine-panel cover: halftone field, title, script, badge. */
function drawTitleBlock(ctx, rect, state, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = grade.ink;
  ctx.fillRect(x, y, w, h);
  drawHalftone(ctx, x, y, w, h, grade.accent, Math.max(2, w * 0.012), Math.max(10, w * 0.055), 0.5);
  const title = (state.title || 'NEON SHORE').trim().toUpperCase();
  const lines = title.split(/\s+/);
  const mid = Math.ceil(lines.length / 2);
  const top = lines.slice(0, mid).join(' ');
  const bottom = lines.slice(mid).join(' ');
  const cx = x + w / 2;
  if (bottom) {
    drawTitleText(ctx, top, cx, y + h * 0.42, w * 0.88, h * 0.24, grade);
    drawTitleText(ctx, bottom, cx, y + h * 0.66, w * 0.88, h * 0.24, grade);
  } else {
    drawTitleText(ctx, top, cx, y + h * 0.52, w * 0.88, h * 0.26, grade);
  }
  if (state.subtitle) {
    drawSubtitle(ctx, state.subtitle, cx, y + h * 0.82, w * 0.84, h * 0.085, grade);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(1.5, w * 0.006);
  ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();
}

/** A bottom title band for the hero and full-bleed layouts. */
function drawTitleBand(ctx, w, h, bandH, state, grade) {
  const y = h - bandH;
  const g = ctx.createLinearGradient(0, y - bandH * 0.4, 0, h);
  g.addColorStop(0, 'rgba(10,6,24,0)');
  g.addColorStop(0.45, 'rgba(10,6,24,0.82)');
  g.addColorStop(1, 'rgba(10,6,24,0.94)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y - bandH * 0.4, w, bandH * 1.4);
  const title = (state.title || 'NEON SHORE').trim().toUpperCase();
  // The badge sits on the right of the band, so the title gets the left 60%.
  drawTitleText(ctx, title, w * 0.05, h - bandH * 0.34, w * 0.60, bandH * 0.52, grade, 'left');
  if (state.subtitle) {
    drawSubtitle(ctx, state.subtitle, w * 0.05, h - bandH * 0.10, w * 0.6, bandH * 0.20, grade, 'left');
  }
  drawBadge(ctx, state.badge || 'LEONIDA', w * 0.86, h - bandH * 0.52, w * 0.24, grade);
}

/** Renders one layout onto ctx at (w, h). Photos come from state.photos by index. */
export function renderLayout(ctx, w, h, state) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const photoAt = (i) => {
    const p = state.panels[i] || { photo: 0, zoom: 1, px: 0, py: 0 };
    const img = state.photos[p.photo] || null;
    return { img, panel: { ...p, seed: i + 1 } };
  };
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, w, h);

  if (state.layout === 'nine') {
    const { rects, title } = ninePanelRects(w, h);
    rects.forEach((r, i) => {
      const { img, panel } = photoAt(i);
      drawPhotoInto(ctx, img, r, panel, grade);
    });
    drawTitleBlock(ctx, title, state, grade);
  } else if (state.layout === 'hero') {
    const m = w * 0.018;
    const g = w * 0.012;
    const bandH = h * 0.22;
    const top = m;
    const ph = h - bandH - m - g;
    const heroW = w * 0.585;
    const { img, panel } = photoAt(0);
    drawPhotoInto(ctx, img, { x: m, y: top, w: heroW, h: ph }, panel, grade);
    const colX = m + heroW + g;
    const colW = w - m - colX;
    const cellH = (ph - 2 * g) / 3;
    for (let i = 0; i < 3; i++) {
      const p = photoAt(i + 1);
      drawPhotoInto(ctx, p.img, { x: colX, y: top + i * (cellH + g), w: colW, h: cellH }, p.panel, grade);
    }
    drawTitleBand(ctx, w, h, bandH, state, grade);
  } else if (state.layout === 'full') {
    const { img, panel } = photoAt(0);
    drawPhotoInto(ctx, img, { x: 0, y: 0, w, h }, panel, grade);
    // A rising sun and skyline ghosted over the top edge for the poster feel.
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawSun(ctx, w * 0.82, h * 0.14, Math.min(w, h) * 0.075, grade.sun);
    ctx.restore();
    drawTitleBand(ctx, w, h, h * 0.26, state, grade);
    // Heat-meter stars along the top edge.
    ctx.fillStyle = grade.accent;
    ctx.font = `${Math.max(14, w * 0.022)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('★ ★ ★ ★ ★', w * 0.03, h * 0.055);
    ctx.textAlign = 'right';
    ctx.fillText('EST. 2026', w * 0.97, h * 0.055);
  } else {
    // tilt: an illustrated Vice City backdrop with three tilted snapshot cards.
    drawSky(ctx, 0, 0, w, h, grade);
    drawSun(ctx, w * 0.5, h * 0.30, Math.min(w, h) * 0.11, grade.sun);
    drawSkyline(ctx, 0, h * 0.52, w, h * 0.30, grade.ink, 42);
    ctx.fillStyle = 'rgba(20,10,40,0.55)';
    ctx.fillRect(0, h * 0.80, w, h * 0.20);
    drawPalm(ctx, w * 0.06, h * 0.84, h * 0.30, grade.ink, 0.3);
    drawPalm(ctx, w * 0.95, h * 0.84, h * 0.26, grade.ink, -0.3);
    const cards = [
      { x: 0.05, y: 0.07, r: -0.06 },
      { x: 0.53, y: 0.05, r: 0.05 },
      { x: 0.29, y: 0.40, r: -0.015 },
    ];
    const cw = w * 0.42;
    const ch = h * 0.36;
    cards.forEach((c, i) => {
      const p = photoAt(i);
      ctx.save();
      ctx.translate(c.x * w + cw / 2, c.y * h + ch / 2);
      ctx.rotate(c.r);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = w * 0.02;
      ctx.shadowOffsetY = h * 0.008;
      ctx.fillStyle = '#fdfcf8';
      ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      drawPhotoInto(ctx, p.img, { x: -cw / 2 + cw * 0.035, y: -ch / 2 + ch * 0.045, w: cw * 0.93, h: ch * 0.86 }, p.panel, grade);
      ctx.restore();
    });
    drawTitleBand(ctx, w, h, h * 0.17, state, grade);
  }

  drawGrain(ctx, w, h, 20261119, 0.000012);
  drawVignette(ctx, w, h, 0.22);
}

/** Draws the cover onto an existing canvas at its own pixel size. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  renderLayout(ctx, canvas.width, canvas.height, state);
}

/** Renders the cover to a fresh canvas at (w, h) and returns it. */
export function renderCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas, state);
  return canvas;
}

/** The panel rects of the current layout, for hit-testing clicks in the editor. */
export function layoutPanelRects(w, h, layout) {
  if (layout === 'nine') return ninePanelRects(w, h).rects;
  if (layout === 'hero') {
    const m = w * 0.018;
    const g = w * 0.012;
    const bandH = h * 0.22;
    const top = m;
    const ph = h - bandH - m - g;
    const heroW = w * 0.585;
    const colX = m + heroW + g;
    const colW = w - m - colX;
    const cellH = (ph - 2 * g) / 3;
    return [
      { x: m, y: top, w: heroW, h: ph },
      { x: colX, y: top, w: colW, h: cellH },
      { x: colX, y: top + cellH + g, w: colW, h: cellH },
      { x: colX, y: top + 2 * (cellH + g), w: colW, h: cellH },
    ];
  }
  if (layout === 'full') return [{ x: 0, y: 0, w, h }];
  const cw = w * 0.42;
  const ch = h * 0.36;
  return [
    { x: 0.05 * w, y: 0.07 * h, w: cw, h: ch },
    { x: 0.53 * w, y: 0.05 * h, w: cw, h: ch },
    { x: 0.29 * w, y: 0.40 * h, w: cw, h: ch },
  ];
}
