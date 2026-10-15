import { base } from "./context.js?v=20261015i";

const assetVersion = "20261015i";

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

export { injectPartial };
