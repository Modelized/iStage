import { createPopupMotion } from "../popup-motion.js?v=20261106e";
import { createRailScroller } from "./rail-scroll.js?v=20261104i";
import { iStageImages } from "./artwork.js?v=20261106i";

function initHighlights(root, { autoplayTarget, autoplayEntryDelay = 1360 } = {}) {
  const rail = root.querySelector("[data-highlight-rail]");
  const stage = root.querySelector("[data-highlight-stage]");
  const controls = root.querySelector("[data-highlight-controls]");
  const controlsTrack = root.querySelector(".highlight-controls-track");
  const playToggle = root.querySelector("[data-highlight-play-toggle]");
  const cards = rail ? Array.from(rail.querySelectorAll(".highlight-card")) : [];
  const dots = controls ? Array.from(controls.querySelectorAll(".progress-dot")) : [];
  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (
    !rail ||
    !stage ||
    !controls ||
    !playToggle ||
    !cards.length
  )
    return;

  if (root.dataset.highlightsReady) return;
  root.dataset.highlightsReady = "true";
  controls.style.setProperty("--highlight-count", cards.length);

  let currentIndex = 0;
  let isPlaying = false;
  let hasStarted = false;
  let userInterrupted = false;
  let autoplayFinished = false;
  let resumeOnReturn = false;
  let playbackTimer = 0;
  let programmaticScroll = false;
  let scrollTicking = false;
  let pageTicking = false;
  let controlsRegion = "above";
  let playbackRegion = "above";
  let playbackAvailable = false;
  let autoplayStartTimer = 0;
  let pointerGesture = null;
  const copies = cards.map((card) => card.querySelector(".highlight-copy"));
  const playbackTargets = autoplayTarget
    ? cards.map((card) => card.querySelector(autoplayTarget))
    : [];
  const artwork = cards.flatMap((card, index) => {
    const media = card.querySelector(
      ".product-highlight-artwork, .highlight-media--zoom-top, .highlight-media--zoom-bottom"
    );
    return media ? [{ media, index, ready: false, visible: false, started: false, timer: 0 }] : [];
  });

  function measureCards() {
    const railBox = rail.getBoundingClientRect();
    return {
      center: railBox.left + railBox.width / 2,
      left: railBox.left,
      right: railBox.right,
      boxes: cards.map((card) => card.getBoundingClientRect())
    };
  }

  // Current-card artwork reveal

  function canRevealArtwork(entry, { left, right, boxes }) {
    const box = boxes[entry.index];
    const visibleWidth = Math.min(right, box.right) - Math.max(left, box.left);
    return entry.ready && entry.visible && entry.index === currentIndex &&
      visibleWidth >= box.width * 0.72;
  }

  function revealArtwork(entry) {
    entry.started = true;
    artworkObserver?.unobserve(entry.media);
    entry.media.classList.add(
      entry.media.matches(".product-highlight-artwork") ? "is-revealed" : "is-zoomed"
    );
  }

  function updateArtworkReveals(metrics = measureCards()) {
    artwork.forEach((entry) => {
      if (entry.started) return;
      if (!canRevealArtwork(entry, metrics)) {
        window.clearTimeout(entry.timer);
        entry.timer = 0;
      } else if (!entry.timer) {
        entry.timer = window.setTimeout(() => {
          entry.timer = 0;
          if (canRevealArtwork(entry, measureCards())) revealArtwork(entry);
        }, 160);
      }
    });
  }

  const artworkObserver = !reduceMotion && "IntersectionObserver" in window
    ? new IntersectionObserver((changes) => {
      changes.forEach(({ target, isIntersecting }) => {
        const entry = artwork.find((item) => item.media === target);
        if (entry) entry.visible = isIntersecting;
      });
      updateArtworkReveals();
    }, { rootMargin: "0px -2% -8% 0px" })
    : null;

  artwork.forEach((entry) => {
    artworkObserver?.observe(entry.media);
    iStageImages.ready(entry.media.querySelector("img")).then(() => {
      entry.ready = true;
      if (!artworkObserver) revealArtwork(entry);
      else updateArtworkReveals();
    });
  });

  // Highlight playback

  function clearCompletedDots() {
    dots.forEach(function (dot) {
      dot.classList.remove("is-complete");
    });
  }

  function clearPlaybackTimer() {
    if (playbackTimer) {
      window.clearTimeout(playbackTimer);
      playbackTimer = 0;
    }
  }

  function restartProgressAnimation() {
    controls.classList.remove("is-progressing");
    void controls.offsetWidth;
    if (isPlaying) controls.classList.add("is-progressing");
  }

  function updateControls() {
    dots.forEach(function (dot, index) {
      const active = index === currentIndex;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
    controls.classList.toggle("is-playing", isPlaying);
    if (!isPlaying) controls.classList.remove("is-progressing");
    playToggle.setAttribute("aria-label", isPlaying ? "Pause highlights" : "Play highlights");
    updateArtworkReveals();
  }

  function scheduleNext() {
    clearPlaybackTimer();
    if (!isPlaying) return;
    playbackTimer = window.setTimeout(function () {
      if (currentIndex === cards.length - 1) {
        dots[currentIndex].classList.add("is-complete");
        autoplayFinished = true;
        pausePlayback();
        return;
      }
      goTo(currentIndex + 1, "auto");
    }, 5000);
  }

  function play() {
    if (document.hidden || document.documentElement.classList.contains("menu-open")) return;
    clearCompletedDots();
    autoplayFinished = false;
    resumeOnReturn = false;
    isPlaying = true;
    hasStarted = true;
    updateControls();
    if (currentIndex === cards.length - 1) {
      goTo(0, "auto");
      return;
    }
    restartProgressAnimation();
    scheduleNext();
  }

  function pausePlayback() {
    if (!isPlaying) return;
    isPlaying = false;
    clearPlaybackTimer();
    updateControls();
  }

  const scroller = createRailScroller(rail, reduceMotion, (active) => {
    programmaticScroll = active;
  });
  const cancelRailAnimation = scroller.cancel;
  const animateRailTo = scroller.to;

  function goTo(index, source) {
    const nextIndex = Math.max(0, Math.min(cards.length - 1, index));
    if (source === "manual") {
      clearCompletedDots();
    }
    currentIndex = nextIndex;
    const targetLeft =
      cards[nextIndex].offsetLeft - (rail.clientWidth - cards[nextIndex].offsetWidth) / 2;
    const duration = source === "auto" ? 1350 : 1100;

    if (source === "auto") controls.classList.remove("is-progressing");
    updateControls();

    animateRailTo(targetLeft, duration, function () {
      if (!isPlaying) return;
      restartProgressAnimation();
      scheduleNext();
    });
  }

  // Scroll tracking and copy motion

  function nearestCardIndex({ center, boxes }) {
    let nearest = 0;
    let nearestDistance = Infinity;
    boxes.forEach(function (box, index) {
      const distance = Math.abs(box.left + box.width / 2 - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    return nearest;
  }

  function updateCardText(metrics = measureCards()) {
    const { center, boxes } = metrics;
    updateArtworkReveals(metrics);
    // Complete the geometry snapshot before writing any animated copy styles.
    boxes.forEach(function (box, index) {
      const delta = box.left + box.width / 2 - center;
      const ratio = Math.max(-1, Math.min(1, delta / Math.max(box.width * 0.78, 1)));
      const copy = copies[index];
      if (!copy) return;
      const shift = (ratio * 50).toFixed(2) + "px";
      const opacity = String(Math.max(0.16, 1 - Math.abs(ratio) * 0.86));
      if (copy.style.getPropertyValue("--copy-shift") !== shift)
        copy.style.setProperty("--copy-shift", shift);
      if (copy.style.getPropertyValue("--copy-opacity") !== opacity)
        copy.style.setProperty("--copy-opacity", opacity);
    });
  }

  function onRailScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(function () {
      scrollTicking = false;
      const metrics = measureCards();
      if (!programmaticScroll) {
        clearCompletedDots();
        const next = nearestCardIndex(metrics);
        if (next !== currentIndex) {
          currentIndex = next;
          updateControls();
        }
      }
      updateCardText(metrics);
    });
  }

  function stopForUser() {
    cancelRailAnimation();
    clearCompletedDots();
    userInterrupted = true;
    resumeOnReturn = false;
    pausePlayback();
  }

  const popupMotion = createPopupMotion(controls);

  // Viewport visibility

  function updateControlState() {
    pageTicking = false;
    const railBox = rail.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    const playbackBox = playbackTargets[currentIndex]?.getBoundingClientRect() || railBox;
    const visualViewport = window.visualViewport;
    const viewportHeight = visualViewport
      ? visualViewport.height
      : window.innerHeight || document.documentElement.clientHeight;
    const viewportTop = visualViewport ? visualViewport.offsetTop : 0;
    const viewportBottom = viewportTop + viewportHeight;
    const previousRegion = controlsRegion;
    const aboveThreshold = viewportBottom + (previousRegion === "above" ? -4 : 12);
    const playbackAboveThreshold = viewportBottom + (playbackRegion === "above" ? -4 : 12);
    const belowExitThreshold = viewportTop + (playbackRegion === "below" ? 8 : -8);
    let nextRegion = "inside";

    if (railBox.top >= aboveThreshold) nextRegion = "above";

    const nextPlaybackRegion =
      playbackBox.top >= playbackAboveThreshold
        ? "above"
        : stageBox.bottom <= belowExitThreshold ? "below" : "inside";
    const enteringFromAbove = playbackRegion === "above";
    const shouldMount = nextRegion !== "above";
    const wasAvailable = playbackAvailable;
    const controlsEntering = !controls.classList.contains("is-mounted");

    // Sticky positioning stays in CSS so scrolling needs no scripted position handoff.
    if (controlsTrack) {
      const restingBottom = controlsTrack.getBoundingClientRect().bottom -
        parseFloat(getComputedStyle(controlsTrack).paddingBottom);
      const floatingBottom = viewportBottom - parseFloat(getComputedStyle(controls).bottom);
      popupMotion.setDocked(restingBottom <= floatingBottom);
    }
    popupMotion.setVisible(shouldMount);
    controlsRegion = nextRegion;
    playbackRegion = nextPlaybackRegion;
    playbackAvailable = playbackRegion === "inside" && !document.hidden &&
      !document.documentElement.classList.contains("menu-open");

    if (!playbackAvailable) {
      window.clearTimeout(autoplayStartTimer);
      autoplayStartTimer = 0;
      if (isPlaying) {
        resumeOnReturn = !userInterrupted && !autoplayFinished;
        pausePlayback();
      }
      return;
    }

    const canAutoplay = () => !userInterrupted && !autoplayFinished &&
      (hasStarted ? resumeOnReturn : !reduceMotion);
    if (!wasAvailable && canAutoplay()) {
      const delay = enteringFromAbove ? autoplayEntryDelay : controlsEntering ? 1360 : 80;
      autoplayStartTimer = window.setTimeout(() => {
        autoplayStartTimer = 0;
        if (playbackAvailable && controls.classList.contains("is-mounted") && canAutoplay())
          play();
      }, delay);
    }
  }

  function requestControlState() {
    if (pageTicking) return;
    pageTicking = true;
    window.requestAnimationFrame(updateControlState);
  }

  cards.forEach(function (card, index) {
    card.addEventListener("click", function (event) {
      if (event.target.closest("a, button")) return;
      if (index === currentIndex) return;
      stopForUser();
      goTo(index, "manual");
    });
    card.addEventListener("keydown", function (event) {
      if (event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      stopForUser();
      goTo(index, "manual");
    });
  });

  dots.forEach(function (dot, index) {
    dot.addEventListener("click", function () {
      stopForUser();
      goTo(index, "manual");
    });
  });

  playToggle.addEventListener("click", function () {
    if (isPlaying) {
      userInterrupted = true;
      resumeOnReturn = false;
      pausePlayback();
    } else {
      userInterrupted = false;
      resumeOnReturn = false;
      play();
    }
  });

  rail.addEventListener("scroll", onRailScroll, { passive: true });
  rail.addEventListener(
    "pointerdown",
    function (event) {
      pointerGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, decided: false };
    },
    { passive: true }
  );
  rail.addEventListener(
    "pointermove",
    function (event) {
      if (!pointerGesture || pointerGesture.id !== event.pointerId || pointerGesture.decided)
        return;
      const deltaX = Math.abs(event.clientX - pointerGesture.x);
      const deltaY = Math.abs(event.clientY - pointerGesture.y);
      if (Math.max(deltaX, deltaY) < 10) return;
      pointerGesture.decided = true;
      if (deltaX > deltaY * 1.1) stopForUser();
    },
    { passive: true }
  );
  rail.addEventListener(
    "pointerup",
    function () {
      pointerGesture = null;
    },
    { passive: true }
  );
  rail.addEventListener(
    "pointercancel",
    function () {
      pointerGesture = null;
    },
    { passive: true }
  );
  rail.addEventListener(
    "wheel",
    function (event) {
      const horizontalIntent =
        event.shiftKey || Math.abs(event.deltaX) > Math.max(4, Math.abs(event.deltaY) * 0.85);
      if (horizontalIntent) stopForUser();
    },
    { passive: true }
  );
  rail.addEventListener("keydown", function (event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    stopForUser();
    goTo(currentIndex + (event.key === "ArrowRight" ? 1 : -1), "manual");
  });

  window.addEventListener("scroll", requestControlState, { passive: true });
  window.addEventListener("resize", function () {
    requestControlState();
    updateCardText();
  });
  window.addEventListener("orientationchange", requestControlState);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", requestControlState, { passive: true });
    window.visualViewport.addEventListener("scroll", requestControlState, { passive: true });
  }

  document.addEventListener("nav:toggle", updateControlState);
  document.addEventListener("visibilitychange", updateControlState);

  updateControls();
  updateCardText();
  updateControlState();
}

export function initHighlightCarousels(options = {}) {
  document.querySelectorAll("[data-highlights]").forEach((root) => initHighlights(root, options));
}
