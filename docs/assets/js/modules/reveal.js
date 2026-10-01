import { iStageImages } from "./artwork.js?v=20261002a";
import { createScrollReveal } from "../scroll-reveal.js?v=20261002a";
function initReveal() {
  const revealNodes = Array.from(document.querySelectorAll(".reveal, .image-reveal"));
  const onloadNodes = Array.from(document.querySelectorAll(".reveal-onload"));
  const staggerGroups = Array.from(document.querySelectorAll("[data-stagger-reveal]"));
  if (!revealNodes.length && !staggerGroups.length && !onloadNodes.length) {
    return;
  }

  const controller = createScrollReveal();
  const staggeredItems = new Map();

  staggerGroups.forEach((group) => {
    const selector = group.dataset.staggerReveal;
    const items = selector ? Array.from(group.querySelectorAll(selector)) : [];
    items.forEach((item, index) => {
      item.style.setProperty("--reveal-delay", `${(index * 0.09).toFixed(2)}s`);
    });
    staggeredItems.set(group, items);
  });

  const observe = (target) => {
    const groupItems = staggeredItems.get(target);
    // Only dedicated artwork motion waits for an image. A card or staggered
    // group must not wait for every descendant image before it can appear.
    const artwork = target.matches(".image-reveal")
      ? target.querySelector("img")
      : target.matches("img[data-image-motion]")
        ? target
        : null;
    const elements = groupItems || (artwork ? [artwork] : [target]);
    controller.observe(target, {
      elements,
      prepare: artwork ? () => iStageImages.ready(artwork) : undefined,
      reveal: () => {
        (groupItems || [target]).forEach((item) => item.classList.add("is-revealed"));
      }
    });
  };

  new Set([...revealNodes, ...staggerGroups, ...onloadNodes]).forEach(observe);
  onloadNodes.forEach(controller.reveal);
}

export { initReveal };
