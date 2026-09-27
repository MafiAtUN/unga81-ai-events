// Hydrate once the page has loaded and painted, so the header paints before any island code runs.
// If the island's scripts fail to load (a cached page after a new deploy points to files that no
// longer exist), reload once to fetch the current page.
const FLAG = 'unga81.reloaded';

async function reloadOnce(err) {
  let reloaded = false;
  try {
    reloaded = sessionStorage.getItem(FLAG) === '1';
    if (!reloaded) sessionStorage.setItem(FLAG, '1');
  } catch {
    reloaded = true;
  }
  if (reloaded) {
    if (err) console.error(err);
    return;
  }
  // Refresh the browser's cached copy of this page first, so the reload gets the new one.
  await fetch(location.href, { cache: 'reload' }).catch(() => {});
  location.reload();
}

export default (load, _opts, el) => {
  const go = async () => {
    // A cached page may name a script that a newer deploy removed. Check before hydrating.
    const url = el.getAttribute('component-url');
    if (url) {
      const ok = await fetch(url, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok, () => true);
      if (!ok) return reloadOnce();
    }
    try {
      const hydrate = await load();
      await hydrate();
      try {
        sessionStorage.removeItem(FLAG);
      } catch {
        /* storage unavailable */
      }
    } catch (err) {
      reloadOnce(err);
    }
  };
  const after = () => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(go, 0)));
  if (document.readyState === 'complete') after();
  else addEventListener('load', after, { once: true });
};
