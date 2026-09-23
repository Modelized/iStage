"use strict";

/* Shared popup choreography, ported from the iStage 27 highlight controls.
   Layout and visibility belong to each page; motion belongs here. */
window.createPopupMotion = function ({ root, controls, measure, content = [] }) {
  const ease = "cubic-bezier(.42,0,.18,1)";
  const settle = "cubic-bezier(.16,1,.3,1)";
  const split = "cubic-bezier(.42,0,.2,1)";
  const spring = "cubic-bezier(.26,1.16,.72,1)";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const px = (value) => `${value}px`;
  const glass = document.createElement("span");
  glass.className = "popup-glass";
  glass.setAttribute("aria-hidden", "true");
  const blob = document.createElement("span");
  blob.className = "popup-blob";
  blob.setAttribute("aria-hidden", "true");
  root.classList.add("popup-motion");
  const parts = controls.map((control) => {
    control.classList.add("popup-control");
    const surface = document.createElement("span");
    surface.className = "popup-shadow";
    surface.setAttribute("aria-hidden", "true");
    const outline = document.createElement("span");
    outline.className = "popup-outline";
    outline.setAttribute("aria-hidden", "true");
    control.append(outline);
    root.append(surface);
    return { control, surface, outline };
  });
  root.append(glass, blob);
  let visible = false;
  let animations = [];
  let revision = 0;

  function layout() {
    const { height: size, width } = root.getBoundingClientRect();
    const expanded = measure(width, size);
    const merged = controls.map(() => ({ left: (width - size) / 2, width: size }));
    // The original pill tightens slightly while the circular control overshoots.
    const overshoot = expanded.map((box, index) => ({
      left: box.left + (index === 0 ? 6 : 8),
      width: Math.max(size, box.width - (index === 0 ? 12 : 0))
    }));
    return { size, expanded, merged, overshoot };
  }

  function boxFrame(box, size) {
    return { left: px(box.left), width: px(box.width), height: px(size) };
  }

  function surfaceFrame(boxes, index, size) {
    const box = boxes[index];
    const seam = (boxes[0].left + boxes[0].width + boxes[1].left) / 2;
    // Shadows also meet at one seam instead of darkening each other.
    const clipPath =
      index === 0
        ? `inset(-64px ${px(box.left + box.width - seam)} -64px -64px)`
        : `inset(-64px -64px -64px ${px(seam - box.left)})`;
    return { ...boxFrame(box, size), clipPath };
  }

  function glassFrame(boxes, size) {
    const radius = size / 2;
    const paths = boxes.map(({ left, width }) => {
      // Match the glass canvas's 16px horizontal overshoot allowance.
      const x = left + 16;
      const y = 0;
      const right = x + width;
      const bottom = y + size;
      return `M ${x + radius} ${y} H ${right - radius} A ${radius} ${radius} 0 0 1 ${right} ${y + radius} V ${bottom - radius} A ${radius} ${radius} 0 0 1 ${right - radius} ${bottom} H ${x + radius} A ${radius} ${radius} 0 0 1 ${x} ${bottom - radius} V ${y + radius} A ${radius} ${radius} 0 0 1 ${x + radius} ${y} Z`;
    });
    // Two clockwise subpaths use the nonzero union: overlap is painted once.
    // A single backdrop layer also avoids one blurred pill sampling the other.
    return { clipPath: `path("${paths.join(" ")}")` };
  }

  function setVisible(next, immediate = false) {
    if (next === visible && !immediate) return;
    const interrupted = animations.length > 0;
    const { size, expanded, merged, overshoot } = layout();
    const target = next ? expanded : merged;
    const intro = next && !interrupted && !immediate;
    const tracks = [];
    const add = (element, end, frames, duration, easing = ease, delay = 0) => {
      tracks.push({ element, end, frames, duration, easing, delay });
    };
    const shapeFrames = (getFrame) => [
      { offset: 0, ...getFrame(merged) },
      { offset: 0.27, ...getFrame(merged), easing: split },
      { offset: 0.64, ...getFrame(overshoot), easing: spring },
      { offset: 1, ...getFrame(expanded) }
    ];

    add(
      root,
      { transform: next ? "translate(-50%, 0px)" : "translate(-50%, 180px)" },
      intro
        ? [
            { offset: 0, transform: "translate(-50%, 180px)", easing: "cubic-bezier(.48,0,.2,1)" },
            {
              offset: 0.3,
              transform: "translate(-50%, -46px)",
              easing: "cubic-bezier(.34,.02,.2,1)"
            },
            {
              offset: 0.54,
              transform: "translate(-50%, 3px)",
              easing: "cubic-bezier(.32,.04,.2,1)"
            },
            { offset: 1, transform: "translate(-50%, 0px)" }
          ]
        : null,
      intro ? 1200 : 660,
      intro ? "linear" : settle,
      !next && !interrupted ? 520 : 0
    );
    add(
      root,
      { opacity: next ? 1 : 0 },
      intro
        ? [
            { offset: 0, opacity: 0 },
            { offset: 0.07, opacity: 1 },
            { offset: 1, opacity: 1 }
          ]
        : null,
      intro ? 1200 : 220,
      "linear",
      !next && !interrupted ? 580 : 0
    );
    add(
      blob,
      { width: "30px", height: "80px", opacity: 0 },
      intro
        ? [
            {
              offset: 0,
              width: "30px",
              height: "80px",
              opacity: 0,
              easing: "cubic-bezier(.48,0,.2,1)"
            },
            {
              offset: 0.07,
              width: "30px",
              height: "80px",
              opacity: 1,
              easing: "cubic-bezier(.44,0,.2,1)"
            },
            {
              offset: 0.24,
              width: "39px",
              height: "45px",
              opacity: 1,
              easing: "cubic-bezier(.34,.02,.2,1)"
            },
            {
              offset: 0.3,
              width: "40px",
              height: "30px",
              opacity: 1,
              easing: "cubic-bezier(.32,.04,.2,1)"
            },
            { offset: 0.38, width: "35px", height: "32px", opacity: 0 },
            { offset: 1, width: "30px", height: "80px", opacity: 0 }
          ]
        : null,
      intro ? 1200 : 220,
      intro ? "linear" : settle
    );

    add(
      glass,
      glassFrame(target, size),
      intro ? shapeFrames((boxes) => glassFrame(boxes, size)) : null,
      intro ? 1300 : 780,
      intro ? "linear" : settle
    );
    const surfaceOpacity = intro
      ? [
          { offset: 0, opacity: 0 },
          { offset: 0.27, opacity: 0, easing: split },
          { offset: 0.4, opacity: 1 },
          { offset: 1, opacity: 1 }
        ]
      : null;
    add(glass, { opacity: 1 }, surfaceOpacity, intro ? 1300 : 220, intro ? "linear" : settle);

    parts.forEach(({ control, surface, outline }, index) => {
      add(
        control,
        boxFrame(target[index], size),
        intro ? shapeFrames((boxes) => boxFrame(boxes[index], size)) : null,
        intro ? 1300 : 780,
        intro ? "linear" : settle
      );
      add(
        surface,
        surfaceFrame(target, index, size),
        intro ? shapeFrames((boxes) => surfaceFrame(boxes, index, size)) : null,
        intro ? 1300 : 780,
        intro ? "linear" : settle
      );
      add(surface, { opacity: 1 }, surfaceOpacity, intro ? 1300 : 220, intro ? "linear" : settle);
      add(
        outline,
        { opacity: next ? 1 : 0 },
        intro
          ? [
              { offset: 0, opacity: 0 },
              { offset: 0.3, opacity: 0 },
              { offset: 0.46, opacity: 1 },
              { offset: 1, opacity: 1 }
            ]
          : null,
        intro ? 1300 : 220,
        intro ? ease : settle
      );
    });

    content.forEach(({ element, type = "fade", items = [] }) => {
      const end = { opacity: next ? 1 : 0 };
      const start = { opacity: 0 };
      if (type === "unfold") {
        const style = getComputedStyle(element);
        end.width = style.getPropertyValue("--popup-content-width").trim();
        start.width = style.getPropertyValue("--popup-content-collapsed-width").trim();
      } else if (type === "scale") {
        end.transform = next ? "scale(1)" : "scale(.72)";
        start.transform = "scale(.72)";
      }
      add(
        element,
        end,
        intro
          ? [
              { offset: 0, ...start },
              {
                offset: type === "unfold" ? 0.27 : 0.36,
                ...start,
                easing: type === "unfold" ? "cubic-bezier(.3,0,.18,1)" : spring
              },
              { offset: type === "unfold" ? 0.58 : 1, ...end },
              { offset: 1, ...end }
            ]
          : null,
        intro ? 1300 : next ? 360 : 120,
        intro ? "linear" : settle
      );
      items.forEach((item, index) =>
        add(
          item,
          { opacity: 1, transform: "scale(1)" },
          intro
            ? [
                { opacity: 0, transform: "scale(.2)" },
                { opacity: 1, transform: "scale(1)" }
              ]
            : null,
          100,
          "cubic-bezier(.18,.72,.22,.88)",
          intro ? 460 + index * 50 : 0
        )
      );
    });

    // Read the visible frame once, before cancelling or writing any endpoints.
    // Reversals use this snapshot instead of replaying the entrance keyframes.
    tracks.forEach((track) => {
      const style = getComputedStyle(track.element);
      track.start = Object.fromEntries(Object.keys(track.end).map((key) => [key, style[key]]));
    });
    const token = ++revision;
    animations.forEach((animation) => animation.cancel());
    animations = [];
    visible = next;
    root.classList.toggle("is-popup-visible", next);
    root.inert = !next;
    root.setAttribute("aria-hidden", String(!next));
    if (!next && root.contains(document.activeElement)) document.activeElement.blur();
    tracks.forEach(({ element, end }) => Object.assign(element.style, end));
    if (immediate || reduce.matches || !root.animate) return;

    tracks.forEach(({ element, start, end, frames, duration, easing, delay }) => {
      animations.push(
        element.animate(frames || [start, end], { duration, easing, delay, fill: "both" })
      );
    });
    // One timeline origin, including glass, geometry, outlines and contents.
    const startTime = document.timeline.currentTime;
    if (startTime !== null)
      animations.forEach((animation) => {
        animation.startTime = startTime;
      });
    Promise.all(animations.map((animation) => animation.finished))
      .then(() => {
        if (revision !== token) return;
        animations.forEach((animation) => animation.cancel());
        animations = [];
      })
      .catch(() => {});
  }

  const refresh = () => setVisible(visible, true);
  reduce.addEventListener("change", refresh);
  window.addEventListener("resize", refresh, { passive: true });
  refresh();
  return { setVisible, refresh };
};
