import { body } from "./context.js?v=20261002a";
function setNavOpenState(nav, open) {
  const toggle = nav?.querySelector(".nav-toggle");
  const sheet = nav?.querySelector("#mobile-sheet");
  if (!nav || !toggle || !sheet) {
    return;
  }

  nav.classList.toggle("nav--open", open);
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  sheet.setAttribute("aria-hidden", open ? "false" : "true");
  body.classList.toggle("no-scroll", open);
}

function initBrandLogo(nav) {
  const brand = nav?.querySelector(".brand");
  const logo = nav?.querySelector(".brand-logo");
  if (!brand || !logo) {
    return;
  }

  const syncLogoState = () => {
    brand.classList.toggle("has-logo", logo.naturalWidth > 0);
  };

  if (logo.complete) {
    syncLogoState();
  }
  logo.addEventListener("load", syncLogoState);
  logo.addEventListener("error", () => brand.classList.remove("has-logo"));
}

function initNavBackdrop() {
  if (body.dataset.backdropInit === "1") {
    return;
  }
  body.dataset.backdropInit = "1";

  let backdrop = document.querySelector(".nav-backdrop");
  let lastScrolled = null;
  let frame = 0;

  const syncBackdrop = () => {
    frame = 0;
    const scrolled = (window.scrollY || window.pageYOffset || 0) > 4;
    if (scrolled === lastScrolled) {
      return;
    }

    backdrop ||= document.querySelector(".nav-backdrop");
    backdrop?.classList.toggle("is-visible", scrolled);
    body.classList.toggle("nav--scrolled", scrolled);
    lastScrolled = scrolled;
  };

  const queueBackdropSync = () => {
    if (!frame) {
      frame = requestAnimationFrame(syncBackdrop);
    }
  };

  syncBackdrop();
  window.addEventListener("scroll", queueBackdropSync, { passive: true });
  window.addEventListener("resize", queueBackdropSync);
  window.addEventListener("orientationchange", queueBackdropSync);
  window.addEventListener("pageshow", queueBackdropSync);
}

function normalizePath(path) {
  if (!path) {
    return "/";
  }

  const normalized = path.replace(/\/+/g, "/");
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function initMenuThumb(nav) {
  const menu = nav?.querySelector("ul.menu");
  if (!menu || menu.dataset.thumbInit === "1") {
    return;
  }
  menu.dataset.thumbInit = "1";

  const allLinks = Array.from(menu.querySelectorAll("a"));
  const isLegalPath = (path) => (path || "").toLowerCase().includes("/legal");
  const links = allLinks.filter((link) => {
    const text = (link.textContent || "").trim().toLowerCase();
    const href = link.getAttribute("href") || "";
    return link.dataset.noThumb !== "1" && text !== "legal" && !isLegalPath(href);
  });
  if (!links.length) {
    return;
  }

  const currentPath = normalizePath(location.pathname);
  const onLegalPage = isLegalPath(currentPath);
  const current = links.find((link) => {
    try {
      return (
        normalizePath(new URL(link.getAttribute("href"), document.baseURI).pathname) ===
        currentPath
      );
    } catch {
      return false;
    }
  });

  allLinks.forEach((link) => link.classList.remove("is-current"));
  if (!onLegalPage) {
    current?.classList.add("is-current");
  }

  const setThumbTo = (link, show = true) => {
    // The desktop menu has no geometry while hidden in the mobile layout.
    if (!menu.getClientRects().length) return;
    if (!link) {
      menu.style.setProperty("--menu-thumb-o", "0");
      return;
    }

    const menuRect = menu.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const menuStyle = getComputedStyle(menu);
    const parsedPad = parseFloat(menuStyle.getPropertyValue("--menu-thumb-pad"));
    const parsedBorder = parseFloat(menuStyle.borderLeftWidth);
    const pad = Number.isFinite(parsedPad) ? parsedPad : 10;
    const borderLeft = Number.isFinite(parsedBorder) ? parsedBorder : 0;
    const x = linkRect.left - menuRect.left - borderLeft - pad;

    menu.style.setProperty("--menu-thumb-x", `${x}px`);
    menu.style.setProperty("--menu-thumb-w", `${linkRect.width + pad * 2}px`);
    menu.style.setProperty("--menu-thumb-o", show ? "1" : "0");
  };

  const setTarget = (target) => {
    allLinks.forEach((link) => link.classList.toggle("is-target", link === target));
  };

  const snapToCurrent = () => {
    const currentLink = menu.querySelector("a.is-current");
    setThumbTo(currentLink, Boolean(currentLink));
    setTarget(currentLink);
  };

  menu.classList.add("thumb-init");
  snapToCurrent();
  requestAnimationFrame(() => menu.classList.remove("thumb-init"));

  const realign = () => {
    if (!menu.dataset.thumbHovering) {
      snapToCurrent();
    }
  };

  window.addEventListener("resize", realign);
  window.addEventListener("orientationchange", realign);
  document.fonts?.ready.then(realign).catch(() => {});

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(realign);
    observer.observe(menu);
  }

  let frame = 0;
  let target = current || links[0];
  let pointerX = null;
  let leaveTimer = 0;

  const isHoverPointer = (event) => event.pointerType === "mouse" || event.pointerType === "pen";
  const nearestLinkByX = (clientX) => {
    return links.reduce(
      (nearest, link) => {
        const rect = link.getBoundingClientRect();
        const distance = Math.abs(clientX - (rect.left + rect.right) / 2);
        return distance < nearest.distance ? { link, distance } : nearest;
      },
      { link: links[0], distance: Infinity }
    ).link;
  };

  const syncTarget = () => {
    frame = 0;
    if (pointerX !== null) {
      target = nearestLinkByX(pointerX);
      pointerX = null;
    }
    setThumbTo(target);
    setTarget(target);
  };

  const cancelLeave = () => {
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = 0;
    }
  };

  const scheduleLeave = () => {
    cancelLeave();
    leaveTimer = window.setTimeout(() => {
      delete menu.dataset.thumbHovering;
      snapToCurrent();
    }, 180);
  };

  menu.addEventListener("pointerenter", (event) => {
    if (!isHoverPointer(event)) {
      return;
    }

    cancelLeave();
    menu.dataset.thumbHovering = "1";
    if (onLegalPage) {
      menu.style.setProperty("--menu-thumb-o", "0");
    }
  });

  menu.addEventListener("pointermove", (event) => {
    if (!isHoverPointer(event)) {
      return;
    }

    cancelLeave();
    menu.dataset.thumbHovering = "1";
    pointerX = event.clientX;
    if (!frame) {
      frame = requestAnimationFrame(syncTarget);
    }
  });

  menu.addEventListener("pointerleave", (event) => {
    if (isHoverPointer(event)) {
      scheduleLeave();
      return;
    }

    delete menu.dataset.thumbHovering;
    snapToCurrent();
  });

  if (!("PointerEvent" in window)) {
    menu.addEventListener("mousemove", (event) => {
      menu.dataset.thumbHovering = "1";
      pointerX = event.clientX;
      if (!frame) {
        frame = requestAnimationFrame(syncTarget);
      }
    });
    menu.addEventListener("mouseleave", () => {
      delete menu.dataset.thumbHovering;
      snapToCurrent();
    });
  }
}

function initNav() {
  const nav = document.querySelector(".nav");
  if (!nav || nav.dataset.navInit === "1") {
    return;
  }
  nav.dataset.navInit = "1";

  const toggle = nav.querySelector(".nav-toggle");
  const sheet = nav.querySelector("#mobile-sheet");
  if (toggle && sheet) {
    toggle.addEventListener("click", () => {
      setNavOpenState(nav, !nav.classList.contains("nav--open"));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("nav--open")) {
        setNavOpenState(nav, false);
      }
    });
  }

  initBrandLogo(nav);
  initMenuThumb(nav);
  initNavBackdrop();
}

export { initNav };
