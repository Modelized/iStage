"use strict";

/* Shared by the two static sites. Prepare nearby elements, then commit a
   one-shot CSS reveal on a render boundary. Scrolling never cancels playback. */
window.createScrollReveal = function ({ rootMargin = "0px 0px -1% 0px", threshold = 0 } = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const entries = new Map();
  const queued = new Set();
  let frame = 0;
  const canObserve = "IntersectionObserver" in window;

  function release(entry) {
    entry.hints.forEach(([element, value, priority]) => {
      if (value) element.style.setProperty("will-change", value, priority);
      else element.style.removeProperty("will-change");
    });
    entry.hints = [];
  }

  function warm(entry) {
    if (entry.started) return;
    if (!entry.hints.length && !reduce.matches) {
      entry.hints = entry.elements.map((element) => [
        element,
        element.style.getPropertyValue("will-change"),
        element.style.getPropertyPriority("will-change")
      ]);
      entry.elements.forEach((element) =>
        element.style.setProperty("will-change", "transform, opacity")
      );
    }
    if (!entry.preparing) {
      entry.preparing = Promise.resolve()
        .then(entry.prepare)
        .catch(() => {})
        .then(() => {
          entry.ready = true;
          queue(entry);
        });
    }
  }

  function start(entry) {
    if (entry.started) return;
    entry.started = true;
    clearTimeout(entry.timer);
    entry.timer = 0;
    queued.delete(entry);
    observer?.unobserve(entry.target);
    preloader?.unobserve(entry.target);
    entry.reveal();
  }

  function releaseAfterPlayback(entry) {
    // Observe completion only. Never seek, restart or cancel CSS animations.
    const animations = entry.elements.flatMap((element) =>
      element.getAnimations
        ? element
            .getAnimations()
            .filter(
              (animation) =>
                animation.effect?.target === element &&
                (animation.transitionProperty === "transform" ||
                  animation.transitionProperty === "opacity" ||
                  (animation.animationName &&
                    Number.isFinite(animation.effect.getComputedTiming().endTime)))
            )
        : []
    );
    Promise.allSettled(animations.map((animation) => animation.finished)).then(() =>
      release(entry)
    );
  }

  function commit() {
    frame = 0;
    const batch = [...queued].filter(
      (entry) => entry.ready && (entry.inside || entry.forced) && !entry.started
    );
    queued.clear();
    // Apply the whole batch before asking the browser for animation metadata.
    batch.forEach(start);
    batch.forEach(releaseAfterPlayback);
  }

  function queue(entry) {
    if (!entry.ready || entry.started || (!entry.inside && !entry.forced)) return;
    if (reduce.matches || !canObserve) {
      start(entry);
      release(entry);
      return;
    }
    if (entry.delay && !entry.delayReady) {
      if (!entry.timer)
        entry.timer = setTimeout(() => {
          entry.timer = 0;
          entry.delayReady = true;
          queue(entry);
        }, entry.delay);
      return;
    }
    queued.add(entry);
    // Keep the hidden/prepared style in a separate rendering update, including
    // when initialization, image decoding and intersection happen together.
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(commit);
      });
  }

  const observer = canObserve
    ? new IntersectionObserver(
        (changes) => {
          changes.forEach(({ target, isIntersecting }) => {
            const entry = entries.get(target);
            if (!entry || entry.started) return;
            entry.inside = isIntersecting;
            if (entry.inside) {
              warm(entry);
              queue(entry);
            } else {
              clearTimeout(entry.timer);
              entry.timer = 0;
              entry.delayReady = false;
              queued.delete(entry);
            }
          });
        },
        { rootMargin, threshold }
      )
    : null;

  const preloader = canObserve
    ? new IntersectionObserver(
        (changes) => {
          changes.forEach(({ target, isIntersecting }) => {
            const entry = entries.get(target);
            if (!entry || entry.started) return;
            if (isIntersecting) warm(entry);
            else if (!entry.inside && !entry.forced) release(entry);
          });
        },
        { rootMargin: "160px", threshold: 0 }
      )
    : null;

  function observe(target, { elements = [target], prepare = () => {}, reveal, delay = 0 } = {}) {
    if (entries.has(target)) return;
    const entry = {
      target,
      elements: [...new Set(elements)],
      prepare,
      reveal,
      delay,
      hints: [],
      preparing: null,
      ready: false,
      started: false,
      inside: false,
      forced: reduce.matches || !canObserve,
      timer: 0,
      delayReady: false
    };
    entries.set(target, entry);
    observer?.observe(target);
    preloader?.observe(target);
    if (entry.forced) warm(entry);
  }

  function reveal(target) {
    const entry = entries.get(target);
    if (!entry || entry.started) return;
    entry.forced = true;
    warm(entry);
    queue(entry);
  }

  reduce.addEventListener("change", () => {
    if (reduce.matches)
      entries.forEach((entry) => {
        release(entry);
        reveal(entry.target);
      });
  });

  return { observe, reveal };
};
