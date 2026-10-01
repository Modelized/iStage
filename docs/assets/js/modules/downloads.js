function initDownloadAction() {
  const action = document.querySelector(".i27-hero-action");
  const note = action?.querySelector("p");
  const button = action?.querySelector(".btn");
  if (!note || !button) return;

  const alignPadding = () => {
    const padding = parseFloat(getComputedStyle(action).paddingTop);
    const right = padding + Math.max(0, note.offsetHeight - button.offsetHeight) / 2;
    const value = `${right}px`;
    if (action.style.getPropertyValue("--action-right-space") !== value) {
      action.style.setProperty("--action-right-space", value);
    }
  };
  alignPadding();
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(alignPadding);
    observer.observe(note);
    observer.observe(button);
  } else {
    window.addEventListener("resize", alignPadding, { passive: true });
    document.fonts?.ready.then(alignPadding);
  }
}

export { initDownloadAction };
