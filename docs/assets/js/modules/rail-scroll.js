export function createRailScroller(rail, reduceMotion, onStateChange = () => {}) {
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
