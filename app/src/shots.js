// Fixed scenes for screenshots: ?shot=cover draws one exported cover full
// frame; ?shot=editor shows the editor with the sample photos loaded.
// `layout`, `size`, `grade`, `photo` and `caption` come from the query.
// window.__shotReady is set once the scene has painted twice.

/** Runs a screenshot scene: loads the samples, applies the query, then draws. */
export async function runShotScene(shot, query, setup) {
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    document.body.style.overflow = 'hidden';
  }
  await setup({
    layout: query.get('layout') ?? 'nine',
    grade: query.get('grade') ?? 'vice',
    size: query.get('size') ?? 'wide',
    photo: query.get('photo') ?? 'boulevard',
    photo2: query.get('photo2') ?? 'pier',
    title: query.get('caption') ?? 'NEON COAST',
    subtitle: query.get('subtitle') ?? 'sunset heist',
    heat: Number(query.get('heat') ?? 4),
  });
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
