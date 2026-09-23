"use strict";

/* CSS owns geometry, easing and all visual frames. This controller only switches
   states, buffers an unfinished entrance, and manages keyboard availability. */
window.createPopupMotion = function (root) {
  const primary = root.querySelector(".popup-control--primary");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let desired = false;
  let phase = "hidden";
  let timer = 0;
  let frame = 0;

  root.querySelectorAll(".popup-content-item").forEach((item, index) => {
    item.style.setProperty("--popup-item-index", index);
  });

  function clearPending() {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    timer = 0;
    frame = 0;
  }

  function fallback(element, kind, callback) {
    clearTimeout(timer);
    const style = getComputedStyle(element);
    const seconds = (value) =>
      value.trim().endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000;
    const durations = style[kind + "Duration"].split(",").map(seconds);
    const delays = style[kind + "Delay"].split(",").map(seconds);
    const duration = Math.max(
      ...durations.map((value, index) => value + delays[index % delays.length])
    );
    timer = setTimeout(callback, (Number.isFinite(duration) ? duration : 0) + 100);
  }

  function finishExit() {
    if (phase !== "exiting") return;
    clearTimeout(timer);
    phase = "hidden";
  }

  function close() {
    phase = "exiting";
    root.classList.remove("is-mounted");
    fallback(root, "transition", finishExit);
  }

  function finishIntro() {
    if (phase !== "introducing") return;
    clearTimeout(timer);
    phase = "settling";
    root.classList.add("is-intro-settling");
    root.classList.remove("is-introducing");
    // One boundary flush, not a per-frame calculation. Preserve the exact CSS
    // endpoint before enabling exit/reversal transitions.
    void root.offsetWidth;
    frame = requestAnimationFrame(() => {
      frame = 0;
      root.classList.remove("is-intro-settling");
      phase = "open";
      if (!desired) close();
    });
  }

  function settle() {
    clearPending();
    root.classList.add("is-intro-settling");
    root.classList.remove("is-introducing");
    root.classList.toggle("is-mounted", desired);
    phase = desired ? "open" : "hidden";
    void root.offsetWidth;
    root.classList.remove("is-intro-settling");
  }

  function setVisible(next) {
    if (next === desired) return;
    desired = next;
    root.inert = !next;
    root.setAttribute("aria-hidden", String(!next));
    if (!next && root.contains(document.activeElement)) document.activeElement.blur();
    if (reduce.matches) {
      settle();
      return;
    }

    // Do not detach a running CSS entrance halfway through its visual frame.
    // Keep only the latest request; exit transitions can reverse natively.
    if (phase === "introducing" || phase === "settling") return;
    clearPending();
    if (!next) {
      close();
    } else if (phase === "hidden") {
      phase = "introducing";
      root.classList.add("is-mounted", "is-introducing");
      fallback(primary, "animation", finishIntro);
    } else {
      phase = "open";
      root.classList.add("is-mounted");
    }
  }

  root.addEventListener("animationend", (event) => {
    if (event.target === primary && event.animationName === "popup-primary-split") finishIntro();
  });
  root.addEventListener("transitionend", (event) => {
    if (event.target === root && event.propertyName === "transform") finishExit();
  });
  reduce.addEventListener("change", settle);
  root.inert = true;
  root.setAttribute("aria-hidden", "true");
  return { setVisible };
};
