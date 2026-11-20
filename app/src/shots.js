// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover shows the exported cover alone at the requested post size.
// `photo` picks samples (a,b,c loads three), `layout` and `grade` pick the look,
// `caption` the title, `size` one of square/portrait/wide. window.__shotReady is
// set once the scene has painted, so a headless browser can wait on it.
export async function runShot(shot, query, load) {
  const photo = query.get('photo') ?? 'boulevard';
  const layout = query.get('layout') ?? 'nine';
  const grade = query.get('grade') ?? 'sunset';
  const caption = query.get('caption') ?? 'Neon Shore';
  const size = query.get('size') ?? 'square';
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    document.documentElement.classList.add('shot-cover');
    const sizeEl = document.querySelector(`input[name="size"][value="${size}"]`);
    if (sizeEl) sizeEl.click();
  }
  try {
    await load(photo, caption, layout, grade);
  } catch {
    // A missing sample still leaves a complete cover: every panel has a
    // procedural fallback scene, so the shot is never blank.
  }
  // Two frames: one for the draw, one for the browser to present it.
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
