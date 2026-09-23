"use strict";

/* Preserve the original highlight popup lifecycle: every new entrance restarts
   the CSS intro; hiding cancels it and uses the separate CSS exit transitions. */
window.createPopupMotion = function (root) {
  const primary = root.querySelector(".popup-control--primary");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let visible = false;
  let introTimer = 0;
  let introFrame = 0;

  root.querySelectorAll(".popup-content-item").forEach((item, index) => {
    item.style.setProperty("--popup-item-index", index);
  });

  function clearIntroCallbacks() {
    clearTimeout(introTimer);
    cancelAnimationFrame(introFrame);
    introTimer = 0;
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
    // Original fallback for browsers that do not dispatch animationend.
    introTimer = setTimeout(finishIntro, 1800);
  }

  function setVisible(next) {
    if (next === visible) return;
    visible = next;
    root.inert = !next;
    root.setAttribute("aria-hidden", String(!next));
    if (!next && root.contains(document.activeElement)) document.activeElement.blur();

    if (!next) {
      clearIntroCallbacks();
      // Commit the mounted endpoint before removing it. Removing an intro and
      // unmounting in one style update can skip the separate exit transition.
      if (!reduce.matches) finishIntro();
      root.classList.remove("is-introducing", "is-intro-settling");
      if (!reduce.matches) void root.offsetWidth;
    }
    root.classList.toggle("is-mounted", next);
    if (next && !reduce.matches) beginIntro();
  }

  primary.addEventListener("animationend", (event) => {
    if (event.target === primary && event.animationName === "popup-primary-split") finishIntro();
  });
  reduce.addEventListener("change", () => {
    clearIntroCallbacks();
    root.classList.add("is-intro-settling");
    root.classList.remove("is-introducing");
    root.classList.toggle("is-mounted", visible);
    void root.offsetWidth;
  });
  root.inert = true;
  root.setAttribute("aria-hidden", "true");
  return { setVisible };
};
