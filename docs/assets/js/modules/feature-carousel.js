import { createRailScroller } from "./rail-scroll.js?v=20261104i";

// Feature carousels

export function initFeatureCarousels() {
  const carousels = Array.from(document.querySelectorAll("[data-feature-carousel]"));
  if (!carousels.length) return;
  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  carousels.forEach(function (carousel) {
    const rail = carousel.querySelector("[data-feature-rail]");
    const previous = carousel.querySelector("[data-feature-previous]");
    const next = carousel.querySelector("[data-feature-next]");
    const items = rail ? Array.from(rail.querySelectorAll(".feature-item")) : [];
    if (!rail || !previous || !next || !items.length) return;

    if (carousel.dataset.carouselReady) return;
    carousel.dataset.carouselReady = "true";

    let updateFrame = 0;

    const scroller = createRailScroller(rail, reduceMotion);
    const cancelAnimation = scroller.cancel;

    function getMetrics() {
      const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const allVisible = maxLeft <= 1;
      return {
        allVisible: allVisible,
        maxLeft: allVisible ? 0 : maxLeft
      };
    }

    function updateButtons() {
      updateFrame = 0;
      const metrics = getMetrics();
      const left = metrics.allVisible ? 0 : rail.scrollLeft;
      const resetScroll = metrics.allVisible && rail.scrollLeft !== 0;
      carousel.classList.toggle("is-static", metrics.allVisible);
      if (resetScroll) rail.scrollLeft = 0;
      const atStart = metrics.allVisible || left <= 1;
      const atEnd = metrics.allVisible || left >= metrics.maxLeft - 1;
      if (previous.disabled !== atStart) previous.disabled = atStart;
      if (next.disabled !== atEnd) next.disabled = atEnd;
    }

    function requestUpdate() {
      if (updateFrame) return;
      updateFrame = window.requestAnimationFrame(updateButtons);
    }

    function getTargets() {
      const metrics = getMetrics();
      if (metrics.allVisible) return [0];

      const firstLeft = items[0].offsetLeft;
      const targets = items
        .map(function (item) {
          return Math.max(0, item.offsetLeft - firstLeft);
        })
        .filter(function (target) {
          return target < metrics.maxLeft - 1;
        });

      if (!targets.length || Math.abs(targets[targets.length - 1] - metrics.maxLeft) > 1) {
        targets.push(metrics.maxLeft);
      }
      return targets;
    }

    function animateTo(targetLeft) {
      scroller.to(targetLeft, 900, updateButtons);
    }

    function move(direction) {
      const targets = getTargets();
      const current = rail.scrollLeft;
      let destination = current;

      if (direction > 0) {
        const nextTarget = targets.find(function (target) {
          return target > current + 1;
        });
        destination = typeof nextTarget === "number" ? nextTarget : targets[targets.length - 1];
      } else {
        for (let index = targets.length - 1; index >= 0; index -= 1) {
          if (targets[index] < current - 1) {
            destination = targets[index];
            break;
          }
        }
        if (current <= 1) destination = 0;
      }

      animateTo(destination);
    }

    previous.addEventListener("click", function () {
      move(-1);
    });
    next.addEventListener("click", function () {
      move(1);
    });
    rail.addEventListener("scroll", requestUpdate, { passive: true });
    rail.addEventListener("pointerdown", cancelAnimation, { passive: true });
    rail.addEventListener("wheel", cancelAnimation, { passive: true });
    rail.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      move(event.key === "ArrowRight" ? 1 : -1);
    });

    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(function () {
        cancelAnimation();
        const metrics = getMetrics();
        rail.scrollLeft = Math.min(rail.scrollLeft, metrics.maxLeft);
        requestUpdate();
      });
      resizeObserver.observe(rail);
    } else {
      window.addEventListener("resize", requestUpdate);
    }

    updateButtons();
  });
}
