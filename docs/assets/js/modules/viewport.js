// Rubber-band scrolling must not change section visibility at either page edge.
export function normalizeViewport({ scrollY, scrollHeight, clientHeight, height, offsetTop = 0 }) {
  const limit = Math.max(0, scrollHeight - clientHeight);
  const scroll = Math.min(limit, Math.max(0, scrollY));
  const top = Math.min(Math.max(0, clientHeight - height), Math.max(0, offsetTop));
  return { top, bottom: top + height, overscroll: scrollY - scroll };
}

export function readViewport() {
  const scroller = document.scrollingElement || document.documentElement;
  const viewport = window.visualViewport;
  return normalizeViewport({
    scrollY: window.scrollY,
    scrollHeight: scroller.scrollHeight,
    clientHeight: scroller.clientHeight,
    height: viewport?.height ?? window.innerHeight,
    offsetTop: viewport?.offsetTop ?? 0
  });
}
