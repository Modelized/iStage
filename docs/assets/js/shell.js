import "./releases-data.js?v=20261015i";
import { initHeroArtwork } from "./modules/artwork.js?v=20261015i";
import { initDownloadAction } from "./modules/hero-action-layout.js?v=20261015i";
import { initReveal } from "./modules/reveal.js?v=20261015i";
import { injectPartial } from "./modules/site-partials.js?v=20261015i";
import { initYear, initFooterIcon } from "./modules/footer.js?v=20261015i";
import { initNav } from "./modules/navigation.js?v=20261015i";
async function boot() {
  initHeroArtwork();
  initDownloadAction();
  initReveal();

  await Promise.all([
    injectPartial("#nav-slot", "nav.html"),
    injectPartial("#footer-slot", "footer.html")
  ]);

  initNav();
  initYear();
  initFooterIcon();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
