"use strict";

(function () {
  const deck = document.getElementById("help-deck");
  if (!deck || !window.Animation || !window.KeyframeEffect) return;
  const topics = [...deck.querySelectorAll(".help-topic")];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const layers = new Map();
  let selected = null;
  let motion = [];
  let revision = 0;
  let accessFrame = 0;
  let gridHeight = 0;
  let tiles = [];
  let returnFocus = null;
  deck.classList.add("is-ready");
  topics.forEach((topic, index) => {
    topic.querySelector("button").setAttribute("aria-controls", `help-detail-${index}`);
  });

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
      topic.style.setProperty("--tile-height", `${tile.height}px`);
      topic.style.setProperty("--tile-left", `${tile.x}px`);
      topic.style.setProperty("--tile-top", `${tile.y}px`);
    });
  }

  function geometry(layer) {
    const tile = tiles[topics.indexOf(layer.topic)];
    const width = deck.clientWidth;
    const height = layer.content.offsetHeight;
    const canvasHeight = Math.max(gridHeight, height);
    const radius = getComputedStyle(layer.detail).borderTopLeftRadius;
    const dx = tile.x + tile.width / 2 - width / 2;
    const dy = tile.y + tile.height / 2 - height / 2;
    const inset = (x, y, w, h) =>
      `inset(${y}px ${width - x - w}px ${canvasHeight - y - h}px ${x}px round ${radius})`;
    Object.assign(layer.preview.style, {
      left: `${tile.x}px`,
      top: `${tile.y}px`,
      width: `${tile.width}px`,
      height: `${tile.height}px`
    });
    layer.surface.style.transformOrigin = `${tile.x + tile.width / 2}px ${tile.y + tile.height / 2}px`;
    layer.detail.style.height = `${canvasHeight}px`;
    return {
      height,
      closedClip: inset(tile.x, tile.y, tile.width, tile.height),
      openClip: inset(0, 0, width, height),
      smallContent: `translate(${dx}px, ${dy}px) scale(${tile.width / width}, ${tile.height / height})`,
      largePreview: `translate(${-dx}px, ${-dy}px) scale(${width / tile.width}, ${height / tile.height})`
    };
  }

  function progress(layer) {
    const eased = layer.clip ? (layer.clip.effect.getComputedTiming().progress ?? 0) : 1;
    return layer.from + (layer.target - layer.from) * eased;
  }

  function tilesAvailable() {
    return !selected && [...layers.values()].every((layer) => progress(layer) <= 0.2);
  }

  // Timing reads only: no per-frame geometry, computed styles, or blur calculations.
  function updateAccess() {
    const available = tilesAvailable();
    topics.forEach((topic) => {
      if (topic.inert !== !available) topic.inert = !available;
    });
    let waiting = !selected && !available;
    layers.forEach((layer) => {
      const interactive = layer === selected && progress(layer) >= 0.8;
      if (layer.content.inert !== !interactive) {
        layer.content.inert = !interactive;
        layer.content.classList.toggle("is-interactive", interactive);
        if (interactive) layer.back.focus({ preventScroll: true });
      }
      if (layer === selected && !interactive) waiting = true;
    });
    if (available && returnFocus) {
      returnFocus.querySelector("button").focus({ preventScroll: true });
      returnFocus = null;
    }
    cancelAnimationFrame(accessFrame);
    accessFrame = waiting ? requestAnimationFrame(updateAccess) : 0;
  }

  function freezeMotion(continuing = new Set()) {
    const preserved = new Set();
    continuing.forEach((layer) => {
      [layer.detail, layer.content, layer.preview].forEach((element) => preserved.add(element));
    });
    // Capture ALL values before cancelling or writing any of them.
    layers.forEach((layer) => {
      if (continuing.has(layer)) return;
      layer.from = progress(layer);
      layer.target = layer.from;
      layer.clip = null;
    });
    const changing = motion.filter(({ element }) => !preserved.has(element));
    const snapshots = changing.map(({ element, properties }) => {
      const style = getComputedStyle(element);
      return [element, Object.fromEntries(properties.map((key) => [key, style[key]]))];
    });
    snapshots.forEach(([element, values]) => Object.assign(element.style, values));
    revision++;
    changing.forEach(({ animation }) => animation.cancel());
    motion = motion.filter(({ element }) => preserved.has(element));
    cancelAnimationFrame(accessFrame);
  }

  function createLayer(topic) {
    const index = topics.indexOf(topic);
    const surface = document.createElement("div");
    surface.className = "help-layer";
    surface.innerHTML = `<section class="help-detail" id="help-detail-${index}" aria-labelledby="help-detail-title-${index}">
      <div class="help-detail-preview" aria-hidden="true"></div>
      <div class="help-detail-content" inert>
        <button class="help-back" aria-label="Back to help topics">
          <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <h2 class="help-detail-title" id="help-detail-title-${index}"></h2>
        <div class="prose"></div>
      </div>
    </section>`;
    const layer = {
      topic,
      surface,
      detail: surface.querySelector(".help-detail"),
      preview: surface.querySelector(".help-detail-preview"),
      content: surface.querySelector(".help-detail-content"),
      back: surface.querySelector(".help-back"),
      from: 0,
      target: 0,
      clip: null
    };
    // Preserve both the original tile layout and its current background motion.
    const label = topic.querySelector(".help-topic-heading").cloneNode(true);
    const labelButton = label.querySelector("button");
    labelButton.removeAttribute("aria-controls");
    labelButton.removeAttribute("aria-expanded");
    labelButton.tabIndex = -1;
    layer.preview.inert = true;
    layer.preview.append(label);
    layer.content.querySelector(".help-detail-title").textContent =
      topic.querySelector(".help-tile-label > span").textContent;
    layer.content.querySelector(".prose").innerHTML = topic.querySelector(".prose").innerHTML;
    const style = getComputedStyle(topic);
    Object.assign(surface.style, {
      opacity: style.opacity,
      transform: style.transform,
      filter: style.filter
    });
    deck.append(surface);
    layers.set(topic, layer);
    const g = geometry(layer);
    layer.detail.style.clipPath = g.closedClip;
    Object.assign(layer.content.style, { opacity: "0", transform: g.smallContent });
    Object.assign(layer.preview.style, { opacity: "1", transform: "none" });
    Object.assign(topic.style, { opacity: "0", transform: "none", filter: "" });
    layer.back.addEventListener("click", () => {
      if (selected !== layer || progress(layer) < 0.8) return;
      changeSelection(null);
    });
    return layer;
  }

  function animate(element, target, duration, hold = 0, finish = 1) {
    const properties = Object.keys(target);
    const style = getComputedStyle(element);
    const start = Object.fromEntries(properties.map((key) => [key, style[key]]));
    const frames = [
      { ...start, offset: 0 },
      ...(hold ? [{ ...start, offset: hold }] : []),
      { ...target, offset: finish },
      ...(finish < 1 ? [{ ...target, offset: 1 }] : [])
    ];
    const animation = new Animation(
      new KeyframeEffect(element, frames, {
        duration: reduceMotion.matches ? 1 : duration,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both"
      }),
      document.timeline
    );
    motion.push({ element, properties, animation, fresh: true });
    return animation;
  }

  function backgroundTarget(topic, hidden) {
    const tile = tiles[topics.indexOf(topic)];
    const dx = (deck.clientWidth / 2 - tile.x - tile.width / 2) * 0.06;
    const dy = (gridHeight / 2 - tile.y - tile.height / 2) * 0.06;
    return {
      opacity: hidden ? "0" : "1",
      transform: hidden ? `translate(${dx}px, ${dy}px) scale(.94)` : "none",
      filter: hidden && !reduceMotion.matches ? "blur(12px)" : "blur(0px)"
    };
  }

  function settle() {
    freezeMotion();
    layers.forEach((layer, topic) => {
      if (layer === selected) {
        layer.from = layer.target = 1;
        Object.assign(layer.surface.style, { opacity: "1", transform: "none", filter: "" });
        Object.assign(layer.detail.style, { height: "", clipPath: "" });
        Object.assign(layer.content.style, { opacity: "1", transform: "none" });
        layer.preview.style.opacity = "0";
      } else {
        layer.surface.remove();
        layers.delete(topic);
      }
    });
    topics.forEach((topic) => {
      // Invisible tiles need no persistent blur/compositing surface at rest.
      Object.assign(topic.style, { opacity: selected ? "0" : "", transform: "", filter: "" });
      if (!selected) {
        ["width", "height", "left", "top"].forEach((key) =>
          topic.style.removeProperty(`--tile-${key}`)
        );
      }
    });
    if (!selected) {
      deck.classList.remove("is-active");
      deck.style.height = "";
    }
    updateAccess();
  }

  function changeSelection(topic) {
    if (topic && !tilesAvailable()) return;
    if (!deck.classList.contains("is-active")) {
      measureGrid();
      deck.style.height = `${gridHeight}px`;
      deck.classList.add("is-active");
    }
    const incoming = layers.get(topic);
    // A departing card keeps its existing shrinking timeline. Only its outer
    // blur/fade retargets when it becomes a background card for a new selection.
    const continuing = new Set(
      [...layers.values()].filter((layer) => layer !== incoming && layer.target === 0 && layer.clip)
    );
    freezeMotion(continuing);
    if (!topic && selected) returnFocus = selected.topic;
    selected = topic ? layers.get(topic) || createLayer(topic) : null;
    if (selected) {
      returnFocus = null;
      // Put the incoming surface above any card that is still shrinking away.
      deck.append(selected.surface);
    }
    const currentRevision = revision;
    let targetHeight = gridHeight;
    layers.forEach((layer) => {
      const open = layer === selected;
      if (!continuing.has(layer)) {
        const g = geometry(layer);
        // Settled surfaces need an explicit rectangle, not the keyword 'none'.
        if (layer.from === 1) layer.detail.style.clipPath = g.openClip;
        if (layer.from === 0) layer.detail.style.clipPath = g.closedClip;
        layer.target = open ? 1 : 0;
        if (open) targetHeight = g.height;
        layer.clip = animate(layer.detail, { clipPath: open ? g.openClip : g.closedClip }, 780);
        animate(layer.content, { transform: open ? "none" : g.smallContent }, 780);
        animate(layer.preview, { transform: open ? g.largePreview : "none" }, 780);
        animate(layer.content, { opacity: open ? "1" : "0" }, 780, open ? 0.4 : 0, open ? 1 : 0.4);
        animate(layer.preview, { opacity: open ? "0" : "1" }, 780, open ? 0 : 0.4, open ? 0.4 : 1);
      }
      animate(layer.surface, backgroundTarget(layer.topic, !!selected && !open), 1000);
    });
    topics.forEach((item) => {
      item.querySelector("button").setAttribute("aria-expanded", String(selected?.topic === item));
      if (layers.has(item)) return;
      // Reconstruct a hidden endpoint only while invisible; visible interrupted
      // tiles always retain the snapshot taken above.
      if (getComputedStyle(item).opacity === "0") {
        Object.assign(item.style, backgroundTarget(item, true));
      }
      animate(item, backgroundTarget(item, !!selected), 1000);
    });
    animate(deck, { height: `${targetHeight}px` }, 780);
    motion.forEach((entry) => {
      if (!entry.fresh) return;
      // Let pending playback wait for the first rendered frame. Assigning a
      // startTime here bypasses that wait and counts setup time as animation time.
      entry.animation.currentTime = 0;
      entry.animation.play();
      entry.fresh = false;
    });
    updateAccess();
    Promise.all(motion.map(({ animation }) => animation.finished))
      .then(() => {
        if (revision === currentRevision) settle();
      })
      .catch(() => {});
  }

  topics.forEach((topic) => {
    topic.querySelector("button").addEventListener("click", () => {
      if (!tilesAvailable()) return;
      const firstOpen = !deck.classList.contains("is-active");
      const top = firstOpen ? deck.getBoundingClientRect().top : 0;
      changeSelection(topic);
      if (firstOpen && top < 90)
        deck.scrollIntoView({
          behavior: reduceMotion.matches ? "instant" : "smooth",
          block: "start"
        });
    });
  });
  deck.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selected && progress(selected) >= 0.8) {
      event.preventDefault();
      changeSelection(null);
    }
  });

  let width = deck.clientWidth;
  const onResize = (entries) => {
    const nextWidth = entries?.[0]?.contentRect.width ?? deck.clientWidth;
    if (nextWidth === width) return;
    width = nextWidth;
    if (!deck.classList.contains("is-active")) return;
    settle();
    if (!selected) return;
    deck.classList.remove("is-active");
    deck.style.height = "";
    measureGrid();
    deck.classList.add("is-active");
    const g = geometry(selected);
    deck.style.height = `${g.height}px`;
    selected.detail.style.height = "";
    selected.preview.style.transform = g.largePreview;
  };
  if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(deck);
  else window.addEventListener("resize", onResize, { passive: true });
})();
