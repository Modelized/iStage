import "../shell.js?v=20261106i";
import { iStageImages } from "../modules/artwork.js?v=20261106i";
import { initHighlightCarousels } from "../modules/highlight-carousel.js?v=20261106i";
import { initFeatureCarousels } from "../modules/feature-carousel.js?v=20261104i";

import { initProductNavigation } from "../modules/product-navigation.js?v=20261106h";

initProductNavigation();
initHighlightCarousels();
initFeatureCarousels();

const decodeImage = (image) => (image ? iStageImages.ready(image) : Promise.resolve());

// Showcase viewport motion

(function () {
  const showcase = document.getElementById("i27-showcase-grid");
  const frame = showcase ? showcase.closest(".i27-design-showcase") : null;
  if (!showcase || !frame) return;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const images = Array.from(showcase.querySelectorAll("img"));
  let ready = reduce;
  let ticking = false;
  let desiredState = "before";

  function updateState() {
    ticking = false;
    const box = frame.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportTop = visualViewport ? visualViewport.offsetTop : 0;
    const viewportHeight = visualViewport
      ? visualViewport.height
      : window.innerHeight || document.documentElement.clientHeight;
    const viewportBottom = viewportTop + viewportHeight;

    if (box.top >= viewportBottom) desiredState = "before";
    else if (box.bottom <= viewportTop) desiredState = "after";
    else desiredState = "active";

    if (ready && showcase.dataset.showcaseState !== desiredState) {
      showcase.dataset.showcaseState = desiredState;
    }
  }

  function requestState() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateState);
  }

  Promise.all(images.map(decodeImage)).then(function () {
    ready = true;
    requestState();
  });

  window.addEventListener("scroll", requestState, { passive: true });
  window.addEventListener("resize", requestState);
  window.addEventListener("orientationchange", requestState);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", requestState, { passive: true });
    window.visualViewport.addEventListener("scroll", requestState, { passive: true });
  }
  updateState();
})();
