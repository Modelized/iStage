"use strict";

/* CSS defines every visual frame. Keep its animation players attached so a
   visibility change reverses the current frame instead of replacing it. */
window.createPopupMotion = function (root) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let desired = false;
  let players = [];
  let leader = null;
  let duration = 0;
  let revision = 0;

  root.querySelectorAll(".popup-content-item").forEach((item, index) => {
    item.style.setProperty("--popup-item-index", index);
  });

  function prepare() {
    root.classList.add("has-popup-animation");
    players = root
      .getAnimations({ subtree: true })
      .filter((animation) => animation.animationName?.startsWith("popup-"));
    leader = players.find((animation) => animation.animationName === "popup-primary-split");
    duration = Math.max(
      0,
      ...players.map((animation) => animation.effect.getComputedTiming().endTime)
    );
    players.forEach((animation) => {
      // Shorter effects (including staggered dots) hold their final frame until
      // the common endpoint. They then reverse on the same clock as the shell.
      const endTime = animation.effect.getComputedTiming().endTime;
      animation.effect.updateTiming({ endDelay: duration - endTime });
      animation.pause();
      animation.currentTime = 0;
    });
  }

  function hold(time) {
    players.forEach((animation) => {
      animation.pause();
      animation.currentTime = time;
    });
  }

  function playToTarget() {
    const operation = ++revision;
    const endpoint = desired ? duration : 0;
    const time = Math.max(0, Math.min(duration, leader.currentTime ?? 0));
    if (time === endpoint) {
      hold(endpoint);
      return;
    }

    players.forEach((animation) => {
      animation.pause();
      animation.currentTime = time;
      animation.playbackRate = desired ? 1 : -1;
      // Leave startTime to the browser's pending-play task, so setup time is
      // not counted as already-rendered animation time.
      animation.play();
    });
    Promise.all(players.map((animation) => animation.finished)).then(
      () => {
        if (operation === revision) hold(endpoint);
      },
      () => {
        // A reduced-motion change may cancel these players.
      }
    );
  }

  function updateMotionPreference() {
    ++revision;
    root.classList.remove("has-popup-animation");
    players.forEach((animation) => animation.cancel());
    players = [];
    leader = null;
    if (!reduce.matches) {
      prepare();
      hold(desired ? duration : 0);
    }
  }

  function setVisible(next) {
    if (next === desired) return;
    desired = next;
    root.inert = !next;
    root.setAttribute("aria-hidden", String(!next));
    if (!next && root.contains(document.activeElement)) document.activeElement.blur();
    if (!reduce.matches && !leader) prepare();
    root.classList.toggle("is-mounted", next);
    if (!reduce.matches && leader) playToTarget();
  }

  reduce.addEventListener("change", updateMotionPreference);
  root.inert = true;
  root.setAttribute("aria-hidden", "true");
  return { setVisible };
};
