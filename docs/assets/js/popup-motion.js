"use strict";

/* CSS owns the original entrance and the separate merge-and-drop exit.
   JS only changes visibility and hands off an interrupted entrance once. */
window.createPopupMotion = function (root) {
  const primary = root.querySelector(".popup-control--primary");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const controls = [...root.querySelectorAll(".popup-control")];
  const contents = [
    ...root.querySelectorAll(".popup-content--unfold, .popup-content--scale, .popup-content-item")
  ];
  const blob = root.querySelector(".popup-blob");
  let desired = false;
  let phase = "hidden";
  let revision = 0;

  root.querySelectorAll(".popup-content-item").forEach((item, index) => {
    item.style.setProperty("--popup-item-index", index);
  });

  function finishWithoutMotion() {
    root.classList.add("is-popup-snapshot");
    root.classList.remove("is-introducing");
    root.classList.toggle("is-mounted", desired);
    // Flush only at a handoff, never on each animation frame.
    void root.offsetWidth;
    root.classList.remove("is-popup-snapshot");
    phase = desired ? "open" : "hidden";
  }

  function handOffIntro() {
    const snapshots = [root, ...controls, ...contents, blob].filter(Boolean).map((element) => {
      const style = getComputedStyle(element);
      const properties =
        element === root
          ? ["opacity", "transform"]
          : ["opacity", "transform", "width", "height", "left"];
      return {
        element,
        values: properties.map((property) => [property, style.getPropertyValue(property)])
      };
    });
    controls.forEach((element) => {
      const surface = getComputedStyle(element, "::before");
      const outline = getComputedStyle(element, "::after");
      snapshots.push({
        element,
        values: [
          ["--popup-frozen-surface-opacity", surface.opacity],
          ["--popup-frozen-surface-color", surface.backgroundColor],
          ["--popup-frozen-outline-opacity", outline.opacity]
        ]
      });
    });
    root.classList.add("is-popup-snapshot");
    root.classList.remove("is-introducing");
    snapshots.forEach(({ element, values }) =>
      values.forEach(([property, value]) => element.style.setProperty(property, value))
    );
    void root.offsetWidth;
    root.classList.remove("is-popup-snapshot");
    root.classList.toggle("is-mounted", desired);
    snapshots.forEach(({ element, values }) =>
      values.forEach(([property]) => element.style.removeProperty(property))
    );
  }

  function settleAfter(animations, operation, callback) {
    if (!animations.length) {
      callback();
      return;
    }
    Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (operation === revision) callback();
    });
  }

  function setVisible(next) {
    if (next === desired) return;
    const operation = ++revision;
    desired = next;
    root.inert = !next;
    root.setAttribute("aria-hidden", String(!next));
    if (!next && root.contains(document.activeElement)) document.activeElement.blur();
    if (reduce.matches) {
      finishWithoutMotion();
    } else if (next && phase === "hidden") {
      phase = "intro";
      root.classList.add("is-mounted", "is-introducing");
      const intro = primary
        .getAnimations()
        .find((animation) => animation.animationName === "popup-primary-split");
      settleAfter(intro ? [intro] : [], operation, finishWithoutMotion);
    } else {
      if (phase === "intro") handOffIntro();
      else root.classList.toggle("is-mounted", next);
      phase = "transition";
      // Native CSS transitions retarget from their currently rendered value.
      // Wait for shell geometry, not hover or carousel playback effects. A
      // near-hidden root may have no transform transition while controls merge.
      const hosts = new Set([root, ...controls]);
      const movement = root
        .getAnimations({ subtree: true })
        .filter(
          (animation) =>
            hosts.has(animation.effect.target) &&
            ["transform", "opacity", "width", "left"].includes(animation.transitionProperty)
        );
      settleAfter(movement, operation, () => {
        phase = desired ? "open" : "hidden";
      });
    }
  }

  reduce.addEventListener("change", () => {
    ++revision;
    finishWithoutMotion();
  });
  root.inert = true;
  root.setAttribute("aria-hidden", "true");
  return { setVisible };
};
