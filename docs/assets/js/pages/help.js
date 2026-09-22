"use strict";

(function () {
  const deck = document.getElementById("help-deck");
  if (!deck || !Element.prototype.animate) return;
  const topics = [...deck.querySelectorAll(".help-topic")];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const detail = document.createElement("section");
  detail.className = "help-detail";
  detail.id = "help-detail";
  detail.hidden = true;
  detail.setAttribute("aria-labelledby", "help-detail-title");
  detail.innerHTML = `<div class="help-detail-preview" aria-hidden="true"></div>
    <div class="help-detail-content">
      <button class="help-back" aria-label="Back to help topics">
        <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <h2 class="help-detail-title" id="help-detail-title"></h2>
      <div class="prose"></div>
    </div>`;
  deck.append(detail);
  deck.classList.add("is-ready");
  const preview = detail.querySelector(".help-detail-preview");
  const content = detail.querySelector(".help-detail-content");
  const back = detail.querySelector(".help-back");
  let active = null;
  let expanded = false;
  let motion = [];
  let revision = 0;
  let gridHeight = 0;
  let tiles = [];

  function measureGrid() {
    const origin = deck.getBoundingClientRect();
    gridHeight = deck.offsetHeight;
    tiles = topics.map((topic) => {
      const rect = topic.getBoundingClientRect();
      return {
        x: rect.left - origin.left,
        y: rect.top - origin.top,
        width: rect.width,
        height: rect.height
      };
    });
    topics.forEach((topic, index) => {
      const tile = tiles[index];
      topic.style.setProperty("--tile-width", `${tile.width}px`);
      topic.style.setProperty("--tile-left", `${tile.x}px`);
      topic.style.setProperty("--tile-top", `${tile.y}px`);
    });
  }

  function cancelMotion() {
    revision++;
    motion.forEach(({ animation }) => animation.cancel());
    motion = [];
  }

  function settle() {
    cancelMotion();
    deck.style.height = "";
    detail.style.height = "";
    detail.style.clipPath = "";
    content.style.opacity = "";
    content.style.transform = "";
    preview.style.opacity = "0";
    preview.style.transform = "";
    topics.forEach((topic) => {
      topic.style.opacity = "";
      topic.style.transform = "";
      topic.style.filter = "";
    });
    if (expanded) return;
    detail.hidden = true;
    deck.classList.remove("is-active");
    topics.forEach((topic) => {
      topic.inert = false;
      topic.style.removeProperty("--tile-width");
      topic.style.removeProperty("--tile-left");
      topic.style.removeProperty("--tile-top");
      topic.querySelector("button").setAttribute("aria-expanded", "false");
    });
    active.querySelector("button").focus({ preventScroll: true });
    active = null;
    preview.replaceChildren();
  }

  function geometry() {
    const tile = tiles[topics.indexOf(active)];
    const width = deck.clientWidth;
    const height = content.offsetHeight;
    const canvasHeight = Math.max(gridHeight, height);
    const radius = getComputedStyle(detail).borderTopLeftRadius;
    const dx = tile.x + tile.width / 2 - width / 2;
    const dy = tile.y + tile.height / 2 - height / 2;
    const inset = (x, y, w, h) =>
      `inset(${y}px ${width - x - w}px ${canvasHeight - y - h}px ${x}px round ${radius})`;
    return {
      tile,
      width,
      height,
      canvasHeight,
      closedClip: inset(tile.x, tile.y, tile.width, tile.height),
      openClip: inset(0, 0, width, height),
      smallContent: `translate(${dx}px, ${dy}px) scale(${tile.width / width}, ${tile.height / height})`,
      largePreview: `translate(${-dx}px, ${-dy}px) scale(${width / tile.width}, ${height / tile.height})`
    };
  }

  function setExpanded(value) {
    if (!active || value === expanded) return;
    const interrupted = motion.length > 0;
    // Snapshot only on input, never once per animation frame.
    const snapshots = motion.map(({ element, properties }) => {
      const style = getComputedStyle(element);
      return {
        element,
        values: Object.fromEntries(properties.map((property) => [property, style[property]]))
      };
    });
    snapshots.forEach(({ element, values }) => Object.assign(element.style, values));
    cancelMotion();
    const g = geometry();
    if (!interrupted) {
      deck.style.height = `${expanded ? g.height : gridHeight}px`;
      detail.style.clipPath = expanded ? g.openClip : g.closedClip;
      content.style.opacity = expanded ? "1" : "0";
      content.style.transform = expanded ? "none" : g.smallContent;
      preview.style.opacity = expanded ? "0" : "1";
      preview.style.transform = expanded ? g.largePreview : "none";
    }
    detail.style.height = `${g.canvasHeight}px`;
    expanded = value;
    active.querySelector("button").setAttribute("aria-expanded", String(value));
    const currentRevision = revision;
    const duration = reduceMotion.matches ? 1 : 780;
    const animate = (element, target, milliseconds = duration, hold = 0, finish = 1) => {
      const properties = Object.keys(target);
      const style = getComputedStyle(element);
      const start = Object.fromEntries(properties.map((property) => [property, style[property]]));
      const frames = [
        { ...start, offset: 0 },
        ...(hold ? [{ ...start, offset: hold }] : []),
        { ...target, offset: finish },
        ...(finish < 1 ? [{ ...target, offset: 1 }] : [])
      ];
      const animation = element.animate(frames, {
        duration: reduceMotion.matches ? 1 : milliseconds,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both"
      });
      motion.push({ element, properties, animation });
    };
    // The rounded clip changes size; its radius and the card itself never scale.
    animate(detail, { clipPath: value ? g.openClip : g.closedClip });
    // Both content boxes track the same rectangle, center, progress and easing as the clip.
    // Only their opacity is staged; scaling never pauses during the handoff.
    animate(content, { transform: value ? "none" : g.smallContent });
    animate(preview, { transform: value ? g.largePreview : "none" });
    animate(content, { opacity: value ? 1 : 0 }, duration, value ? 0.4 : 0, value ? 1 : 0.4);
    animate(preview, { opacity: value ? 0 : 1 }, duration, value ? 0 : 0.4, value ? 0.4 : 1);
    const hiddenTileBlur = reduceMotion.matches ? "blur(0px)" : "blur(12px)";
    topics.forEach((topic, index) => {
      if (topic === active) return;
      const tile = tiles[index];
      const dx = (g.width / 2 - tile.x - tile.width / 2) * 0.06;
      const dy = (gridHeight / 2 - tile.y - tile.height / 2) * 0.06;
      if (!value && !interrupted) {
        topic.style.transform = `translate(${dx}px, ${dy}px) scale(.94)`;
        topic.style.filter = hiddenTileBlur;
      }
      animate(
        topic,
        {
          opacity: value ? 0 : 1,
          transform: value ? `translate(${dx}px, ${dy}px) scale(.94)` : "none",
          filter: value ? hiddenTileBlur : "blur(0px)"
        },
        1000
      );
    });
    animate(deck, { height: `${value ? g.height : gridHeight}px` });
    Promise.all(motion.map(({ animation }) => animation.finished))
      .then(() => {
        if (revision === currentRevision) settle();
      })
      .catch(() => {});
  }

  topics.forEach((topic) => {
    topic.querySelector("button").addEventListener("click", () => {
      if (active) return;
      const top = deck.getBoundingClientRect().top;
      measureGrid();
      active = topic;
      const tile = tiles[topics.indexOf(topic)];
      // Use one surface from the first frame; no original card background underneath.
      const label = document.createElement("div");
      label.className = "help-tile";
      label.innerHTML = topic.querySelector("button").innerHTML;
      preview.replaceChildren(label);
      Object.assign(preview.style, {
        left: `${tile.x}px`,
        top: `${tile.y}px`,
        width: `${tile.width}px`,
        height: `${tile.height}px`
      });
      detail.querySelector("h2").textContent =
        topic.querySelector(".help-tile-label > span").textContent;
      detail.querySelector(".prose").innerHTML = topic.querySelector(".prose").innerHTML;
      topics.forEach((item) => {
        item.inert = true;
        item.style.opacity = item === active ? "0" : "1";
      });
      deck.classList.add("is-active");
      detail.hidden = false;
      setExpanded(true);
      back.focus({ preventScroll: true });
      if (top < 90)
        deck.scrollIntoView({
          behavior: reduceMotion.matches ? "instant" : "smooth",
          block: "start"
        });
    });
  });
  // Retarget from the visible state, with ease-out in either direction.
  back.addEventListener("click", () => setExpanded(!expanded));
  deck.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && active && expanded) {
      event.preventDefault();
      setExpanded(false);
    }
  });

  let width = deck.clientWidth;
  const onResize = (entries) => {
    const nextWidth = entries?.[0]?.contentRect.width ?? deck.clientWidth;
    if (nextWidth === width) return;
    width = nextWidth;
    if (!active) return;
    settle();
    if (!active) return;
    deck.classList.remove("is-active");
    detail.hidden = true;
    measureGrid();
    const tile = tiles[topics.indexOf(active)];
    Object.assign(preview.style, {
      left: `${tile.x}px`,
      top: `${tile.y}px`,
      width: `${tile.width}px`,
      height: `${tile.height}px`
    });
    deck.classList.add("is-active");
    detail.hidden = false;
  };
  if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(deck);
  else window.addEventListener("resize", onResize, { passive: true });
})();
