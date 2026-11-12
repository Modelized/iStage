"use strict";

// Each entrance restarts the CSS intro, while hiding uses separate exit transitions.
export const createPopupMotion = function (root) {
  const firstControl = root.querySelector(".popup-control");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let requestedVisible = false;
  let visible = false;
  let docked = false;
  let introFrame = 0;
  let visibilityFrame = 0;

  root.querySelectorAll(".popup-content-item").forEach((item, index) => {
    item.style.setProperty("--popup-item-index", index);
  });

  function clearIntroCallbacks() {
    cancelAnimationFrame(introFrame);
    introFrame = 0;
  }

  function finishIntro() {
    if (!root.classList.contains("is-introducing")) return;
    clearIntroCallbacks();
    root.classList.add("is-intro-settling");
    root.classList.remove("is-introducing");
    void root.offsetWidth;
  }

  function beginIntro() {
    clearIntroCallbacks();
    root.classList.add("is-intro-settling");
    root.classList.remove("is-introducing");
    void root.offsetWidth;
    root.classList.add("is-introducing");
    introFrame = requestAnimationFrame(() => {
      introFrame = 0;
      root.classList.remove("is-intro-settling");
    });
    // animationend owns completion. A wall-clock fallback can expire while
    // Safari has deferred rendering during a touch scroll.
  }

  function setVisible(next) {
    requestedVisible = next;
    syncVisibility();
  }

  function setDocked(next) {
    if (docked === next) return;
    docked = next;
    root.classList.toggle("is-docked", next);
    syncVisibility();
  }

  function syncVisibility() {
    const menuOpen = document.documentElement.classList.contains("menu-open");
    const next = requestedVisible && (!menuOpen || docked);
    root.inert = !next || menuOpen;
    root.setAttribute("aria-hidden", String(!next || menuOpen));
    if (next === visible) return;
    visible = next;
    cancelAnimationFrame(visibilityFrame);
    if (!next && root.contains(document.activeElement)) document.activeElement.blur();

    if (!next) {
      clearIntroCallbacks();
      // Keep the mounted endpoint through a rendering boundary. A layout read
      // alone does not give the compositor a frame before the exit is applied.
      if (!reduce.matches) finishIntro();
      root.classList.remove("is-introducing", "is-intro-settling");
      if (!reduce.matches) void root.offsetWidth;
    }
    const commitVisibility = () => {
      visibilityFrame = 0;
      if (root.classList.contains("is-mounted") === visible) return;
      root.classList.toggle("is-mounted", visible);
      if (visible && !reduce.matches) beginIntro();
    };
    if (reduce.matches) {
      commitVisibility();
    } else {
      visibilityFrame = requestAnimationFrame(() => {
        visibilityFrame = requestAnimationFrame(commitVisibility);
      });
    }
  }

  firstControl.addEventListener("animationend", (event) => {
    if (event.target === firstControl && event.animationName === "popup-split") finishIntro();
  });
  document.addEventListener("nav:toggle", syncVisibility);
  reduce.addEventListener("change", () => {
    cancelAnimationFrame(visibilityFrame);
    visibilityFrame = 0;
    clearIntroCallbacks();
    root.classList.add("is-intro-settling");
    root.classList.remove("is-introducing");
    root.classList.toggle("is-mounted", visible);
    void root.offsetWidth;
  });
  root.inert = true;
  root.setAttribute("aria-hidden", "true");
  return { setVisible, setDocked };
};
