import "./releases-data.js?v=20261002a";
import { initHeroArtwork } from "./modules/artwork.js?v=20261002a";
import { initDownloadAction } from "./modules/downloads.js?v=20261002a";
import { initReveal } from "./modules/reveal.js?v=20261002a";
import { injectPartial, initYear, initFooterIcon } from "./modules/core.js?v=20261002a";
import { initNav } from "./modules/navigation.js?v=20261002a";
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
