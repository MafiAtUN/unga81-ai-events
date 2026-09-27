// Hydrate once the page has loaded and painted, so the header paints before any island code runs.
export default (load) => {
  const go = async () => {
    const hydrate = await load();
    await hydrate();
  };
  const after = () => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(go, 0)));
  if (document.readyState === 'complete') after();
  else addEventListener('load', after, { once: true });
};
