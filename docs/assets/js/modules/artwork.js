const iStageImages = (() => {
  const pending = new WeakMap();
  function ready(image) {
    const source = image.currentSrc || image.src;
    const cached = pending.get(image);
    if (cached?.source === source) return cached.promise;
    const loaded = image.complete
      ? Promise.resolve()
      : new Promise((resolve) => {
          const finish = () => {
            image.removeEventListener("load", finish);
            image.removeEventListener("error", finish);
            resolve();
          };
          image.addEventListener("load", finish);
          image.addEventListener("error", finish);
        });
    const promise = loaded.then(() =>
      image.naturalWidth && image.decode ? image.decode().catch(() => {}) : undefined
    );
    pending.set(image, { source, promise });
    return promise;
  }
  return { ready };
})();

function initHeroArtwork() {
  // Visible PNG bounds measured once in source pixels, excluding transparent padding.
  const bounds = {
    "hero-iStage-series.png": [367, 118, 1427, 1921],
    "releases-hero.png": [367, 118, 1427, 1921],
    "help-hero.png": [367, 118, 1427, 1921],
    "hero-iStage-27-desktop.png": [1130, 160, 1604, 1839],
    "hero-iStage-27-mobile.png": [290, 160, 1604, 1839],
    "hero-iStage-18-desktop.png": [1460, 160, 920, 1839],
    "hero-iStage-18-mobile.png": [622, 160, 916, 1839]
  };
  document
    .querySelectorAll(
      ".page-hero-media, .event-visual, .page-home .media, .comparison-card .promo-card__media"
    )
    .forEach((frame) => {
      const image = frame.querySelector("img");
      if (!image) return;
      frame.classList.add("artwork-frame", "image-reveal");
      const fit = () => {
        if (!image.naturalWidth) return;
        const name = new URL(image.currentSrc || image.src, document.baseURI).pathname
          .split("/")
          .pop();
        const [x, y, width, height] = bounds[name] || [
          0,
          0,
          image.naturalWidth,
          image.naturalHeight
        ];
        const style = getComputedStyle(frame);
        const size = parseFloat(style.getPropertyValue("--artwork-scale")) || 1;
        const alignY = parseFloat(style.getPropertyValue("--artwork-align-y"));
        const frameWidth = frame.clientWidth;
        const frameHeight = frame.clientHeight;
        const scale = Math.min(frameWidth / width, frameHeight / height) * size;
        const values = {
          width: `${image.naturalWidth * scale}px`,
          height: `${image.naturalHeight * scale}px`,
          left: `${(frameWidth - width * scale) / 2 - x * scale}px`,
          top: `${(frameHeight - height * scale) * (Number.isFinite(alignY) ? alignY : 0.5) - y * scale}px`,
          transformOrigin: `${(x + width / 2) * scale}px ${(y + height / 2) * scale}px`
        };
        Object.entries(values).forEach(([key, value]) => {
          if (image.style[key] !== value) image.style[key] = value;
        });
      };
      image.addEventListener("load", fit);
      iStageImages.ready(image).then(fit);
      if ("ResizeObserver" in window) new ResizeObserver(fit).observe(frame);
      else window.addEventListener("resize", fit, { passive: true });
    });
}

export { iStageImages, initHeroArtwork };
