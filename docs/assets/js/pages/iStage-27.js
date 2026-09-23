"use strict";

function createRailScroller(rail, reduceMotion, onStateChange = () => {}) {
  let frame = 0;
  function cancel() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    rail.classList.remove("is-animating");
    onStateChange(false);
  }
  function to(targetLeft, duration, onComplete) {
    cancel();
    const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const destination = Math.max(0, Math.min(maxLeft, targetLeft));
    const startLeft = rail.scrollLeft;
    const distance = destination - startLeft;
    if (reduceMotion || Math.abs(distance) < 1) {
      rail.scrollLeft = destination;
      onComplete?.();
      return;
    }
    onStateChange(true);
    rail.classList.add("is-animating");
    const startedAt = performance.now();
    function step(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      rail.scrollLeft = startLeft + distance * eased;
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        frame = 0;
        rail.scrollLeft = destination;
        rail.classList.remove("is-animating");
        onStateChange(false);
        onComplete?.();
      }
    }
    frame = requestAnimationFrame(step);
  }
  return { cancel, to };
}

const decodeImage = (image) => (image ? iStageImages.ready(image) : Promise.resolve());

(function () {
  const rail = document.getElementById("highlight-rail");
  const stage = document.getElementById("highlight-stage");
  const controls = document.getElementById("highlight-controls");
  const controlsAnchor = document.getElementById("highlight-controls-anchor");
  const controlsFixedGuide = document.getElementById("highlight-controls-fixed-guide");
  const playToggle = document.getElementById("highlight-play-toggle");
  const cards = rail ? Array.from(rail.querySelectorAll(".highlight-card")) : [];
  const dots = controls ? Array.from(controls.querySelectorAll(".progress-dot")) : [];
  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (
    !rail ||
    !stage ||
    !controls ||
    !controlsAnchor ||
    !controlsFixedGuide ||
    !playToggle ||
    !cards.length
  )
    return;

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
  let autoplayStartTimer = 0;
  let pointerGesture = null;

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
    clearCompletedDots();
    autoplayFinished = false;
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

  function nearestCardIndex() {
    const railBox = rail.getBoundingClientRect();
    const center = railBox.left + railBox.width / 2;
    let nearest = 0;
    let nearestDistance = Infinity;
    cards.forEach(function (card, index) {
      const box = card.getBoundingClientRect();
      const distance = Math.abs(box.left + box.width / 2 - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    return nearest;
  }

  function updateCardText() {
    const railBox = rail.getBoundingClientRect();
    const center = railBox.left + railBox.width / 2;
    cards.forEach(function (card) {
      const box = card.getBoundingClientRect();
      const delta = box.left + box.width / 2 - center;
      const ratio = Math.max(-1, Math.min(1, delta / Math.max(box.width * 0.78, 1)));
      const copy = card.querySelector(".highlight-copy");
      if (!copy) return;
      copy.style.setProperty("--copy-shift", (ratio * 42).toFixed(2) + "px");
      copy.style.setProperty("--copy-opacity", String(Math.max(0.16, 1 - Math.abs(ratio) * 0.86)));
    });
  }

  function onRailScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(function () {
      scrollTicking = false;
      if (!programmaticScroll) {
        clearCompletedDots();
        const next = nearestCardIndex();
        if (next !== currentIndex) {
          currentIndex = next;
          updateControls();
        }
      }
      updateCardText();
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

  function updateControlPosition() {
    pageTicking = false;
    const railBox = rail.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    const anchorBox = controlsAnchor.getBoundingClientRect();
    const fixedGuideBox = controlsFixedGuide.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportHeight = visualViewport
      ? visualViewport.height
      : window.innerHeight || document.documentElement.clientHeight;
    const viewportTop = visualViewport ? visualViewport.offsetTop : 0;
    const viewportBottom = viewportTop + viewportHeight;
    const anchorCenter = anchorBox.top + anchorBox.height / 2;
    const fixedCenter = fixedGuideBox.top + fixedGuideBox.height / 2;
    const previousRegion = controlsRegion;
    const aboveThreshold = viewportBottom + (previousRegion === "above" ? -4 : 12);
    const dockThreshold = fixedCenter + (previousRegion === "below" ? 8 : -4);
    const belowExitThreshold = viewportTop + (playbackRegion === "below" ? 8 : -8);
    let nextRegion = "inside";

    if (railBox.top >= aboveThreshold) nextRegion = "above";
    else if (anchorCenter <= dockThreshold) nextRegion = "below";

    const nextPlaybackRegion =
      nextRegion === "above" ? "above" : stageBox.bottom <= belowExitThreshold ? "below" : "inside";
    const enteringFromAbove = nextRegion !== "above" && previousRegion === "above";
    const returningFromBelow = nextPlaybackRegion === "inside" && playbackRegion === "below";
    const shouldMount = nextRegion !== "above";

    if (nextRegion === "above") {
      window.clearTimeout(autoplayStartTimer);
    }

    controls.classList.toggle("is-docked", nextRegion === "below");
    popupMotion.setVisible(shouldMount);

    if (enteringFromAbove) {
      if (!hasStarted && !reduceMotion && nextPlaybackRegion === "inside") {
        window.clearTimeout(autoplayStartTimer);
        autoplayStartTimer = window.setTimeout(function () {
          if (
            !hasStarted &&
            controls.classList.contains("is-mounted") &&
            playbackRegion === "inside"
          )
            play();
        }, 1360);
      } else if (
        resumeOnReturn &&
        !userInterrupted &&
        !autoplayFinished &&
        nextPlaybackRegion === "inside"
      ) {
        window.clearTimeout(autoplayStartTimer);
        autoplayStartTimer = window.setTimeout(function () {
          if (
            controls.classList.contains("is-mounted") &&
            playbackRegion === "inside" &&
            !userInterrupted &&
            !autoplayFinished
          )
            play();
        }, 1360);
      }
    }

    controlsRegion = nextRegion;
    playbackRegion = nextPlaybackRegion;

    if (returningFromBelow && !hasStarted && !reduceMotion) {
      window.clearTimeout(autoplayStartTimer);
      autoplayStartTimer = window.setTimeout(function () {
        if (!hasStarted && playbackRegion === "inside") play();
      }, 80);
    } else if (returningFromBelow && resumeOnReturn && !userInterrupted && !autoplayFinished) {
      window.clearTimeout(autoplayStartTimer);
      autoplayStartTimer = window.setTimeout(function () {
        if (
          controls.classList.contains("is-mounted") &&
          playbackRegion === "inside" &&
          !userInterrupted &&
          !autoplayFinished
        )
          play();
      }, 80);
    }

    if (nextPlaybackRegion !== "inside" && isPlaying) {
      resumeOnReturn = !userInterrupted && !autoplayFinished;
      pausePlayback();
    }
  }

  function requestControlPosition() {
    if (pageTicking) return;
    pageTicking = true;
    window.requestAnimationFrame(updateControlPosition);
  }

  cards.forEach(function (card, index) {
    card.addEventListener("click", function () {
      if (index === currentIndex) return;
      stopForUser();
      goTo(index, "manual");
    });
    card.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
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

  window.addEventListener("scroll", requestControlPosition, { passive: true });
  window.addEventListener("resize", function () {
    requestControlPosition();
    updateCardText();
  });
  window.addEventListener("orientationchange", requestControlPosition);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", requestControlPosition, { passive: true });
    window.visualViewport.addEventListener("scroll", requestControlPosition, { passive: true });
  }

  updateControls();
  updateCardText();
  updateControlPosition();
})();

/* Zoom selected highlight artwork once, after the same eager image load used by every card. */
(function () {
  const mediaNodes = Array.from(
    document.querySelectorAll(".highlight-media--zoom-top, .highlight-media--zoom-bottom")
  );
  if (!mediaNodes.length) return;
  const controller = createScrollReveal({
    threshold: 0.72,
    rootMargin: "0px -2% -8% 0px"
  });
  mediaNodes.forEach(function (media) {
    const image = media.querySelector("img");
    controller.observe(media, {
      elements: image ? [image] : [],
      prepare: () => decodeImage(image),
      delay: 160,
      reveal: () => media.classList.add("is-zoomed")
    });
  });
})();

/* Shared manual carousels for the feature cards. */
(function () {
  const carousels = Array.from(document.querySelectorAll("[data-feature-carousel]"));
  if (!carousels.length) return;
  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  carousels.forEach(function (carousel) {
    const rail = carousel.querySelector("[data-feature-rail]");
    const previous = carousel.querySelector("[data-feature-previous]");
    const next = carousel.querySelector("[data-feature-next]");
    const items = rail ? Array.from(rail.querySelectorAll(".i27-feature-item")) : [];
    if (!rail || !previous || !next || !items.length) return;

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
      carousel.classList.toggle("is-static", metrics.allVisible);
      if (metrics.allVisible && rail.scrollLeft !== 0) rail.scrollLeft = 0;
      previous.disabled = metrics.allVisible || rail.scrollLeft <= 1;
      next.disabled = metrics.allVisible || rail.scrollLeft >= metrics.maxLeft - 1;
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
})();

/* Move the showcase forward or backward whenever it crosses the viewport. */
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
