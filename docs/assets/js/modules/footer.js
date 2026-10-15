import { base } from "./context.js?v=20261015i";

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

export { initYear, initFooterIcon };
