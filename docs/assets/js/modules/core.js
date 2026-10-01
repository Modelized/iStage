import { base, assetVersion } from "./context.js?v=20261002a";
function getPartialUrl(file) {
  if (!base || base === ".") {
    return `assets/partials/${file}?v=${assetVersion}`;
  }

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/assets/partials/${file}?v=${assetVersion}`;
}

async function injectPartial(selector, file) {
  const slot = document.querySelector(selector);
  if (!slot) {
    return;
  }

  try {
    const response = await fetch(getPartialUrl(file));
    if (!response.ok) {
      throw new Error(`${file} fetch failed: ${response.status}`);
    }
    slot.innerHTML = await response.text();
  } catch (error) {
    console.error("Partial load failed", error);
  }
}

function initFooterIcon() {
  const image = document.querySelector("[data-footer-icon]");
  if (!image) return;
  const title = image.closest(".footer-title");
  const sync = () => {
    title.dataset.iconState = image.naturalWidth > 0 ? "loaded" : "failed";
  };
  image.addEventListener("load", sync, { once: true });
  image.addEventListener("error", sync, { once: true });
  image.src = new URL(`${base}/assets/img/iStage-icon.png`, document.baseURI).href;
  if (image.complete) sync();
}

function initYear() {
  const year = String(new Date().getFullYear());
  document.querySelectorAll("#year, [data-year]").forEach((node) => {
    node.textContent = year;
  });
}

export { injectPartial, initYear, initFooterIcon };
