// Wires the Neon Shore editor: photos in, layout/grade/caption controls, a live
// preview canvas, drag-to-pan and wheel-to-zoom per panel, and a one-click PNG
// export in the three common post sizes. A `?shot=` query sets up a fixed scene
// for a screenshot instead (./shots.js). Photos never leave the machine.
import { drawCover, renderCover, defaultState, GRADES, LAYOUTS, SIZES, layoutPanelRects } from './cover.js';
import { runShot } from './shots.js';

const state = defaultState();
const canvas = document.getElementById('cover');
const status = document.getElementById('status');
let selectedPanel = 0;
let fontsReady = false;

const $ = (id) => document.getElementById(id);

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Re-sizes the preview canvas to the chosen export size and redraws the cover. */
function redraw() {
  const size = SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  $('zoom').value = String(Math.round(((state.panels[selectedPanel] || {}).zoom || 1) * 100));
  $('panelLabel').textContent = `Panel ${selectedPanel + 1} of ${LAYOUTS[state.layout].panels}`;
}

function setStatus(text) {
  status.textContent = text;
}

/** Builds the layout and grade radio groups from the engine's own tables. */
function buildPickers() {
  const layoutBox = $('layouts');
  Object.entries(LAYOUTS).forEach(([key, def], i) => {
    const label = document.createElement('label');
    label.className = 'pick';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'layout';
    input.value = key;
    input.checked = i === 0;
    input.addEventListener('change', () => {
      state.layout = key;
      selectedPanel = 0;
      redraw();
      setStatus(`${def.label} layout — ${def.panels} photo panels.`);
    });
    label.append(input, document.createTextNode(def.label));
    layoutBox.append(label);
  });
  const gradeBox = $('grades');
  Object.entries(GRADES).forEach(([key, def], i) => {
    const label = document.createElement('label');
    label.className = 'pick';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'grade';
    input.value = key;
    input.checked = i === 0;
    input.addEventListener('change', () => {
      state.grade = key;
      redraw();
      setStatus(`${def.label} grade applied.`);
    });
    label.append(input, document.createTextNode(def.label));
    gradeBox.append(label);
  });
  const sizeBox = $('sizes');
  Object.entries(SIZES).forEach(([key, def], i) => {
    const label = document.createElement('label');
    label.className = 'pick';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'size';
    input.value = key;
    input.checked = i === 0;
    input.addEventListener('change', () => {
      state.size = key;
      redraw();
      setStatus(`Export size: ${def.label}.`);
    });
    label.append(input, document.createTextNode(def.label));
    sizeBox.append(label);
  });
}

function wirePhotos() {
  [1, 2, 3].forEach((n) => {
    $(`photo${n}`).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        state.photos[n - 1] = await loadImage(URL.createObjectURL(file));
        redraw();
        setStatus(`Photo ${n} loaded: ${file.name}.`);
      } catch {
        setStatus(`Photo ${n} could not be read.`);
      }
    });
  });
  $('samples').addEventListener('click', async () => {
    const names = ['boulevard', 'neon', 'pier'];
    try {
      const loaded = await Promise.all(names.map((n) => loadImage(`samples/${n}.jpg`)));
      state.photos = loaded;
      redraw();
      setStatus('Sample photos loaded — swap in your own any time.');
    } catch {
      setStatus('Sample photos could not be loaded.');
    }
  });
  $('shuffle').addEventListener('click', () => {
    const keys = Object.keys(GRADES);
    state.grade = keys[Math.floor(Math.random() * keys.length)];
    document.querySelector(`input[name="grade"][value="${state.grade}"]`).checked = true;
    state.panels.forEach((p) => {
      p.photo = Math.floor(Math.random() * 3);
      p.zoom = 1 + Math.random() * 0.25;
      p.px = (Math.random() - 0.5) * 0.2;
      p.py = (Math.random() - 0.5) * 0.2;
    });
    redraw();
    setStatus('Shuffled the panels and grade — keep what you like.');
  });
}

function wireText() {
  $('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  $('badge').addEventListener('input', (e) => { state.badge = e.target.value; redraw(); });
}

function wirePanelTools() {
  $('zoom').addEventListener('input', (e) => {
    const p = state.panels[selectedPanel];
    if (p) p.zoom = Number(e.target.value) / 100;
    redraw();
  });
  $('cyclePhoto').addEventListener('click', () => {
    const p = state.panels[selectedPanel];
    if (!p) return;
    p.photo = (p.photo + 1) % 3;
    redraw();
    setStatus(`Panel ${selectedPanel + 1} now shows photo ${p.photo + 1}.`);
  });
  $('resetPanel').addEventListener('click', () => {
    const p = state.panels[selectedPanel];
    if (!p) return;
    p.zoom = 1; p.px = 0; p.py = 0;
    redraw();
    setStatus(`Panel ${selectedPanel + 1} reset.`);
  });
  // Drag on the canvas pans the panel under the pointer; the wheel zooms it.
  let drag = null;
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const pt = toCanvas(e);
    const rects = layoutPanelRects(canvas.width, canvas.height, state.layout);
    const hit = rects.findIndex((r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h);
    if (hit >= 0) {
      selectedPanel = hit;
      drag = { x: pt.x, y: pt.y };
      canvas.setPointerCapture(e.pointerId);
      redraw();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pt = toCanvas(e);
    const rects = layoutPanelRects(canvas.width, canvas.height, state.layout);
    const r = rects[selectedPanel];
    const p = state.panels[selectedPanel];
    if (r && p) {
      p.px = Math.max(-0.5, Math.min(0.5, p.px + (pt.x - drag.x) / r.w));
      p.py = Math.max(-0.5, Math.min(0.5, p.py + (pt.y - drag.y) / r.h));
      drag = { x: pt.x, y: pt.y };
      redraw();
    }
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = state.panels[selectedPanel];
    if (!p) return;
    p.zoom = Math.max(1, Math.min(3, p.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    redraw();
  }, { passive: false });
}

function wireExport() {
  $('export').addEventListener('click', async () => {
    const size = SIZES[state.size];
    setStatus('Exporting…');
    const out = renderCover(state, size.w, size.h);
    out.toBlob((blob) => {
      if (!blob) { setStatus('Export failed — try again.'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `neon-shore-${size.w}x${size.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setStatus(`Saved neon-shore-${size.w}x${size.h}.png — share it.`);
    }, 'image/png');
  });
}

const shot = new URLSearchParams(location.search).get('shot');
async function start() {
  // The vendored OFL fonts carry the lettering; draw once with fallbacks, then
  // again once Anton and Pacifico arrive so the first paint is never blank.
  redraw();
  try {
    await Promise.all([
      document.fonts.load('400 100px Anton'),
      document.fonts.load('400 60px Pacifico'),
    ]);
    fontsReady = true;
    redraw();
  } catch {
    // System fallbacks (Arial Black / cursive) still draw a clean cover.
  }
  if (shot) {
    runShot(shot, new URLSearchParams(location.search), async (sample, text, layout, grade) => {
      const names = sample.split(',');
      const loaded = await Promise.all(
        names.map((n) => loadImage(`samples/${n.trim()}.jpg`).catch(() => null)),
      );
      state.photos = [loaded[0] || null, loaded[1] || null, loaded[2] || null];
      if (layout) state.layout = layout;
      if (grade) state.grade = grade;
      if (text) state.title = text;
      redraw();
    });
  }
}

buildPickers();
wirePhotos();
wireText();
wirePanelTools();
wireExport();
start();
