export function initProductNavigation() {
  document.querySelectorAll("[data-product-navigation]").forEach(initProductNav);
}

function initProductNav(track) {
  if (track.dataset.navigationReady) return;
  const hero = document.getElementById(track.dataset.productHero);
  const nav = track.querySelector(".product-nav");
  const title = nav?.querySelector(".product-nav-title");
  const panel = nav?.querySelector(".product-nav-panel");
  const titleSlot = nav?.querySelector(".product-nav-title-slot");
  const explore = nav?.querySelector(".product-nav-explore");
  const exploreLabel = nav?.querySelector(".product-nav-explore-label");
  const compactGet = nav?.querySelector(".product-nav-get");
  const disclosure = nav?.querySelector(".product-nav-disclosure");
  const sectionWrap = nav?.querySelector(".product-nav-section-wrap");
  if (!hero || !nav || !title || !titleSlot || !panel || !explore || !exploreLabel || !compactGet || !disclosure || !sectionWrap) return;
  track.dataset.navigationReady = "true";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sectionLinks = [...nav.querySelectorAll(".product-nav-sections a")];
  const sections = sectionLinks.map((link) => document.querySelector(link.hash));
  const background = [...document.querySelectorAll("main, #nav-slot, #footer-slot")];
  const previousInert = new Map();
  const layoutAnimations = new Set();
  const overviewAnimations = new Set();
  const exploreName = explore.getAttribute("aria-label");
  let expanded = false;
  let visible = false;
  let updateFrame = 0;
  let layoutRevision = 0;
  let transitioning = false;
  let pendingLayout = false;
  let layoutWidth = track.clientWidth;

  function setEntryDelays() {
    let index = 0;
    const overviewOpen = disclosure.getAttribute("aria-expanded") === "true";
    panel.querySelectorAll("[data-product-enter]").forEach((element) => {
      if (!overviewOpen && sectionWrap.contains(element)) return;
      element.style.setProperty("--product-entry-delay", `${180 + index++ * 45}ms`);
    });
  }

  function cancelAnimations(animations) {
    animations.forEach((animation) => animation.cancel());
    animations.clear();
  }

  function animate(animations, element, from, to, duration, delay = 0) {
    if (reduceMotion.matches) return null;
    const animation = element.animate([from, to], {
      duration,
      delay,
      fill: "backwards",
      easing: "cubic-bezier(.22, 1, .36, 1)"
    });
    animations.add(animation);
    animation.onfinish = () => animations.delete(animation);
    return animation;
  }

  function measureExplore() {
    const button = compactGet.querySelector(".btn");
    const style = getComputedStyle(button);
    const width = exploreLabel.getBoundingClientRect().width
      + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    nav.style.setProperty("--product-explore-width", `${Math.ceil(width)}px`);
  }

  function layoutPanel(animateChange = false, duration = expanded ? 560 : 360) {
    const current = nav.getBoundingClientRect();
    const titleFrom = title.getBoundingClientRect();
    const toggleFrom = explore.getBoundingClientRect();
    const revision = ++layoutRevision;
    cancelAnimations(layoutAnimations);
    transitioning = animateChange && !reduceMotion.matches;
    nav.classList.toggle("is-transitioning", transitioning);
    nav.classList.toggle("is-expanded", expanded);
    track.classList.toggle("is-expanded", expanded);

    // The same title joins the panel's normal flow and scrolls with its content.
    if (expanded) titleSlot.append(title);
    else nav.prepend(title);
    const height = expanded ? panel.getBoundingClientRect().height
      : parseFloat(getComputedStyle(nav).getPropertyValue("--product-bar-height"));
    nav.style.height = `${height}px`;
    if (!transitioning) return;

    const titleTo = title.getBoundingClientRect();
    const toggleTo = explore.getBoundingClientRect();
    animate(layoutAnimations, nav, { height: `${current.height}px` }, { height: `${height}px` }, duration);
    animate(layoutAnimations, title,
      { transform: `translate(${titleFrom.left - titleTo.left}px, ${titleFrom.top - titleTo.top}px) scale(${titleFrom.width / titleTo.width}, ${titleFrom.height / titleTo.height})` },
      { transform: "none" }, duration);
    animate(layoutAnimations, explore,
      { width: `${toggleFrom.width}px`, height: `${toggleFrom.height}px`, transform: `translateX(${toggleFrom.right - toggleTo.right}px)` },
      { width: `${toggleTo.width}px`, height: `${toggleTo.height}px`, transform: "none" }, duration);
    Promise.allSettled([...layoutAnimations].map((animation) => animation.finished)).then(() => {
      if (revision !== layoutRevision) return;
      transitioning = false;
      nav.classList.remove("is-transitioning");
      if (pendingLayout) refreshLayout();
    });
  }

  function setExpanded(open, restoreFocus = true) {
    if (expanded === open) return;
    expanded = open;
    if (open) setEntryDelays();
    cancelAnimations(overviewAnimations);
    explore.setAttribute("aria-expanded", String(open));
    explore.setAttribute("aria-label", open ? "Close Explore" : exploreName);
    panel.setAttribute("aria-hidden", String(!open));
    panel.inert = !open;
    compactGet.inert = open;
    if (open) {
      background.forEach((element) => {
        previousInert.set(element, element.inert);
        element.inert = true;
      });
      nav.setAttribute("role", "dialog");
      nav.setAttribute("aria-modal", "true");
      panel.scrollTop = 0;
    } else {
      background.forEach((element) => { element.inert = previousInert.get(element) || false; });
      previousInert.clear();
      nav.removeAttribute("role");
      nav.removeAttribute("aria-modal");
    }
    layoutPanel(true);
    if (open || (restoreFocus && visible)) explore.focus({ preventScroll: true });
  }

  // Preserve the page scroll container while the panel owns touch scrolling.
  const backdrop = track.querySelector(".product-nav-backdrop");
  backdrop.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
  backdrop.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
  backdrop.addEventListener("click", () => setExpanded(false));
  explore.addEventListener("click", () => setExpanded(!expanded));
  ["wheel", "touchmove"].forEach((type) => {
    nav.addEventListener(type, (event) => {
      if (expanded && (transitioning || !panel.contains(event.target))) event.preventDefault();
    }, { passive: false });
  });

  disclosure.addEventListener("click", () => {
    const open = disclosure.getAttribute("aria-expanded") !== "true";
    const current = sectionWrap.getBoundingClientRect();
    const style = getComputedStyle(sectionWrap);
    const from = { height: `${current.height}px`, opacity: style.opacity, transform: style.transform };
    cancelAnimations(overviewAnimations);
    disclosure.setAttribute("aria-expanded", String(open));
    sectionWrap.setAttribute("aria-hidden", String(!open));
    sectionWrap.inert = !open;
    sectionWrap.classList.toggle("is-collapsed", !open);
    setEntryDelays();
    const height = sectionWrap.getBoundingClientRect().height;
    const duration = open ? 420 : 300;
    layoutPanel(true, duration);
    if (open) {
      animate(overviewAnimations, sectionWrap, { height: from.height }, { height: `${height}px` }, duration);
      sectionLinks.forEach((link, index) => {
        animate(overviewAnimations, link,
          { opacity: 0, transform: "translateY(-10px)" },
          { opacity: 1, transform: "none" }, 460, index * 45);
      });
    } else {
      animate(overviewAnimations, sectionWrap, { height: from.height }, { height: "0px" }, duration);
      animate(overviewAnimations, sectionWrap,
        { opacity: from.opacity, transform: from.transform },
        { opacity: 0, transform: "translateY(-8px)" }, 160);
    }
  });

  sectionLinks.forEach((link, index) => {
    link.addEventListener("click", (event) => {
      const section = sections[index];
      if (!section) return;
      event.preventDefault();
      setExpanded(false, false);
      history.replaceState(null, "", link.hash);
      const inset = parseFloat(getComputedStyle(nav).getPropertyValue("--product-bar-height")) + 36;
      window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - inset, behavior: reduceMotion.matches ? "instant" : "smooth" });
      section.setAttribute("tabindex", "-1");
      section.focus({ preventScroll: true });
    });
  });

  document.addEventListener("keydown", (event) => {
    if (!expanded) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setExpanded(false);
    } else if (event.key === "Tab") {
      const items = [...nav.querySelectorAll("a[href], button:not(:disabled)")].filter((item) => item.getClientRects().length && !item.closest("[hidden], [inert]") && item.getAttribute("aria-disabled") !== "true");
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  });

  function update() {
    updateFrame = 0;
    const nextVisible = hero.getBoundingClientRect().bottom <= 0;
    if (nextVisible !== visible) {
      visible = nextVisible;
      if (!visible) setExpanded(false, false);
      nav.classList.toggle("is-visible", visible);
      nav.setAttribute("aria-hidden", String(!visible));
      nav.inert = !visible;
    }
    const threshold = parseFloat(getComputedStyle(nav).getPropertyValue("--product-bar-height")) + 48;
    let active = 0;
    sections.forEach((section, index) => {
      if (section && section.getBoundingClientRect().top <= threshold) active = index;
    });
    sectionLinks.forEach((link, index) => {
      if (index === active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  function requestUpdate() {
    if (!updateFrame) updateFrame = requestAnimationFrame(update);
  }
  function refreshLayout() {
    // Safari's toolbar resizes the visual viewport during the opening motion.
    // Finish that motion before measuring its new height.
    if (transitioning && layoutWidth === track.clientWidth && !reduceMotion.matches) {
      pendingLayout = true;
      return;
    }
    pendingLayout = false;
    layoutWidth = track.clientWidth;
    cancelAnimations(overviewAnimations);
    measureExplore();
    layoutPanel();
    requestUpdate();
  }
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", refreshLayout);
  window.visualViewport?.addEventListener("resize", () => { if (expanded) refreshLayout(); });
  reduceMotion.addEventListener("change", refreshLayout);
  document.fonts?.ready.then(refreshLayout);
  measureExplore();
  update();
}
