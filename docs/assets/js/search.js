// ========== iStage search ==========
// Lightweight page search for iStage Pages (case-insensitive, space-insensitive).

(function () {
  "use strict";

  // ===== Search index =====
  // Static entries keep extra keywords and pages that are not in the main nav.
  // Nav-derived entries keep iStage pages in sync with the menu.
  const staticItems = [
    {
      label: "Compare",
      url: "compare",
      tokens: ["compare", "comparison", "versions", "vs", "versus"],
    },
    {
      label: "Releases",
      url: "releases",
      tokens: ["releases", "changelogs", "versions", "updates", "upgrades"],
    },
    {
      label: "Help",
      url: "help",
      tokens: ["help", "supports", "faq", "guides"],
    },
    {
      label: "Gallery",
      url: "gallery",
      tokens: ["gallery", "screenshots", "preview"],
    },
    {
      label: "Legal",
      url: "legal",
      tokens: ["legal", "terms", "licenses", "policy"],
    },
  ];

  function collectIStageItems() {
    const items = [];
    const seen = new Set();

    // iStage pages: any nav link whose href contains "iStage-"
    const links = document.querySelectorAll('.menu a[href*="iStage-"]');

    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href === "#" || seen.has(href)) return;
      seen.add(href);

      const label = (link.textContent || "").trim() || href;
      const normalized = normalize(label);
      const digits = normalized.match(/\d+/g) || [];
      const version = digits[0] || "";

      const baseTokens = [];

      if (version) {
        // Base keywords for iStage pages:
        // istage, istage+version, ios, ios+version, lockscreen
        baseTokens.push(
          "istage",
          `istage${version}`,
          "ios",
          `ios${version}`,
          "lockscreen"
        );
      } else {
        baseTokens.push("istage", "ios", "lockscreen");
      }

      // Also allow the normalized label itself
      baseTokens.push(normalized);

      const tokens = baseTokens.map((t) => normalize(t));

      items.push({
        label,
        url: href,
        tokens,
      });
    });

    return items;
  }

  function buildSearchItems() {
    const items = [];
    const seen = new Set();

    // Static pages first
    staticItems.forEach((item) => {
      if (!item || !item.url) return;
      const url = item.url;
      if (seen.has(url)) return;
      seen.add(url);

      const label = item.label || url;
      const baseTokens = item.tokens || [];
      const normalizedLabel = normalize(label);
      const tokens = [normalizedLabel, ...baseTokens.map((t) => normalize(t))];

      items.push({
        label,
        url,
        tokens,
      });
    });

    // Then dynamic iStage pages from the nav
    const istageItems = collectIStageItems();
    istageItems.forEach((item) => {
      if (!item || !item.url) return;
      const url = item.url;
      if (seen.has(url)) return;
      seen.add(url);
      items.push(item);
    });

    return items;
  }

  const searchItems = buildSearchItems();

  // ===== Normalization helpers =====
  function normalize(text) {
    if (!text) return "";
    return text.toString().toLowerCase().replace(/\s+/g, "");
  }

  function findFirstMatch(query) {
    const q = normalize(query);
    if (!q) return null;

    for (const item of searchItems) {
      if (!item || !item.tokens) continue;
      if (item.tokens.some((t) => t.includes(q))) {
        return item;
      }
    }
    return null;
  }

  // ===== DOM bindings =====
  // Expected markup:
  // <button class="nav-icon nav-icon--search" type="button" data-search-open></button>
  //
  // <div class="search-sheet" data-search-sheet hidden>
  //   <div class="search-sheet-inner">
  //     <form class="search-form" data-search-form>
  //       <input type="text" placeholder="Search iStage" data-search-input />
  //     </form>
  //   </div>
  // </div>

  const sheet = document.querySelector("[data-search-sheet]");
  const openButtons = document.querySelectorAll(
    "[data-search-open], .nav-icon--search"
  );

  const input = sheet ? sheet.querySelector("[data-search-input]") : null;
  const form = sheet ? sheet.querySelector("[data-search-form]") : null;
  const inner = sheet ? sheet.querySelector(".search-sheet-inner") : null;

  if (!sheet || !form || !input) {
    // No search UI on this page.
    return;
  }

  // ===== Open / close sheet =====
  let lastActiveElement = null;

  function openSheet() {
    if (!sheet) return;
    if (!sheet.hasAttribute("hidden")) {
      if (input) input.focus();
      return;
    }

    lastActiveElement = document.activeElement;
    sheet.removeAttribute("hidden");

    // Small delay to avoid focus conflicts with transitions.
    window.setTimeout(() => {
      if (input) {
        input.focus();
        input.select();
      }
    }, 10);
  }

  function closeSheet() {
    if (!sheet) return;
    if (sheet.hasAttribute("hidden")) return;

    sheet.setAttribute("hidden", "");

    if (lastActiveElement && typeof lastActiveElement.focus === "function") {
      lastActiveElement.focus();
    }
  }

  // ===== Events =====
  // Search button to open sheet
  openButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openSheet();
    });
  });

  // Click outside card to close
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) {
      closeSheet();
    }
  });

  if (inner) {
    inner.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  // Esc to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSheet();
    }
  });

  // Cmd+K / Ctrl+K to open
  document.addEventListener("keydown", (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
    if (cmdOrCtrl && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      openSheet();
    }
  });

  // Submit to jump to first match
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = input.value;
    const match = findFirstMatch(query);
    if (!match) return;

    closeSheet();

    const url = match.url;
    if (!url) return;

    if (url.startsWith("#")) {
      const target = document.querySelector(url);
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.location.hash = url;
      }
    } else {
      window.location.href = url;
    }
  });
})();
