import "../shell.js?v=20261113a";
import { initHighlightCarousels } from "../modules/highlight-carousel.js?v=20261113a";
import { initFeatureCarousels } from "../modules/feature-carousel.js?v=20261104i";

// Lineup status

const lineup = Array.from(document.querySelectorAll(".lineup-item"));
const versions = lineup.map((item) =>
  Number(item.querySelector("[data-download-version]")?.dataset.downloadVersion)
);
const latestVersion = Math.max(...versions.filter(Number.isFinite));
lineup.forEach((item, index) => {
  if (versions[index] !== latestVersion) return;
  const badge = document.createElement("span");
  badge.className = "lineup-badge";
  badge.textContent = "New";
  item.querySelector(".lineup-copy").prepend(badge);
});

initHighlightCarousels({ autoplayTarget: ".product-highlight-artwork", autoplayEntryDelay: 80 });
initFeatureCarousels();
