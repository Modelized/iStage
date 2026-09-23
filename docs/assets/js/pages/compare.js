"use strict";

(function () {
  const pickA = document.getElementById("pick-a");
  const pickB = document.getElementById("pick-b");
  const details = document.getElementById("compare-details");
  const status = document.getElementById("compare-status");
  if (!pickA || !pickB || !details || !status) return;

  const esc = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[character]
    );

  const renderValue = (value) => {
    if (typeof value !== "boolean") return esc(value);
    return `<span class="compare-support${value ? " compare-support--yes" : ""}" aria-hidden="true">${value ? "✓" : "—"}</span><span class="compare-sr-only">${value ? "Included" : "Not included"}</span>`;
  };

  function createFloatingPickers() {
    const dock = document.createElement("div");
    dock.className = "compare-dock body-content";
    dock.setAttribute("role", "group");
    dock.setAttribute("aria-label", "Compare versions");
    dock.setAttribute("aria-hidden", "true");
    dock.inert = true;
    const blob = document.createElement("div");
    blob.className = "compare-dock-blob";
    blob.setAttribute("aria-hidden", "true");
    const originals = [pickA, pickB];
    const copies = originals.map((original) => {
      const slot = document.createElement("div");
      slot.className = "compare-dock-slot";
      const picker = original.closest(".compare-picker").cloneNode(true);
      const select = picker.querySelector("select");
      select.id = `${original.id}-floating`;
      picker.htmlFor = select.id;
      const outline = document.createElement("span");
      outline.className = "compare-dock-outline";
      outline.setAttribute("aria-hidden", "true");
      picker.append(outline);
      slot.append(picker);
      dock.append(slot);
      return select;
    });
    dock.append(blob);
    document.body.append(dock);
    return { dock, blob, originals, copies };
  }

  function initFloatingMotion({ dock, blob, originals, copies }) {
    const footer = document.getElementById("footer-slot");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const pickers = copies.map((select) => select.closest(".compare-picker"));
    const outlines = pickers.map((picker) => picker.querySelector(".compare-dock-outline"));
    const labels = pickers.flatMap((picker) =>
      [...picker.children].filter((element) => !outlines.includes(element))
    );
    const elements = [dock, blob, ...pickers, ...labels, ...outlines];
    const properties = ["opacity", "transform", "left", "width", "height"];
    const ease = "cubic-bezier(0.42, 0, 0.18, 1)";
    const settleEase = "cubic-bezier(0.16, 1, 0.3, 1)";
    let visible = false;
    let animations = [];
    let revision = 0;
    let frame = 0;

    function stop() {
      // Read all current frames before cancelling, so quick scroll reversals
      // continue from the visible state rather than restarting the intro.
      const snapshots = elements.map((element) => {
        const style = getComputedStyle(element);
        return [element, Object.fromEntries(properties.map((key) => [key, style[key]]))];
      });
      animations.forEach((animation) => animation.cancel());
      animations = [];
      revision++;
      return new Map(snapshots);
    }

    function animate(element, frames, duration, easing = ease, delay = 0) {
      const animation = element.animate(frames, { duration, easing, delay, fill: "both" });
      animations.push(animation);
    }

    function setVisible(next, immediate = false) {
      const interrupted = animations.length > 0;
      const snapshots = stop();
      visible = next;
      dock.classList.toggle("is-visible", next);
      dock.inert = !next;
      dock.setAttribute("aria-hidden", String(!next));
      if (!next && dock.contains(document.activeElement)) document.activeElement.blur();
      if (reduce.matches || immediate || !dock.animate) return;
      const token = revision;
      const slotWidth = pickers[0].parentElement.clientWidth;
      const gap = parseFloat(getComputedStyle(dock).columnGap);
      const finalTransform = "translate(-50%, 0px)";

      if (next && !interrupted) {
        // Same rise, compression, split and settling beats as iStage 27.
        animate(
          dock,
          [
            {
              offset: 0,
              opacity: 0,
              transform: "translate(-50%, 180px)",
              easing: "cubic-bezier(.48,0,.2,1)"
            },
            { offset: 0.07, opacity: 1 },
            {
              offset: 0.3,
              opacity: 1,
              transform: "translate(-50%, -46px)",
              easing: "cubic-bezier(.34,.02,.2,1)"
            },
            {
              offset: 0.54,
              opacity: 1,
              transform: "translate(-50%, 3px)",
              easing: "cubic-bezier(.32,.04,.2,1)"
            },
            { offset: 1, opacity: 1, transform: finalTransform }
          ],
          1200,
          "linear"
        );
        animate(
          blob,
          [
            { offset: 0, width: "30px", height: "80px", opacity: 0 },
            { offset: 0.07, width: "30px", height: "80px", opacity: 1 },
            { offset: 0.24, width: "39px", height: "45px", opacity: 1 },
            { offset: 0.3, width: "40px", height: "30px", opacity: 1 },
            { offset: 0.38, width: "35px", height: "32px", opacity: 0 },
            { offset: 1, width: "30px", height: "80px", opacity: 0 }
          ],
          1200
        );
      } else {
        const start = snapshots.get(dock);
        animate(
          dock,
          [
            { transform: start.transform },
            { transform: next ? finalTransform : "translate(-50%, 180px)" }
          ],
          660,
          settleEase,
          !next && !interrupted ? 520 : 0
        );
        animate(
          dock,
          [{ opacity: start.opacity }, { opacity: next ? 1 : 0 }],
          220,
          "linear",
          !next && !interrupted ? 580 : 0
        );
        const blobStart = snapshots.get(blob);
        animate(
          blob,
          [
            { width: blobStart.width, height: blobStart.height, opacity: blobStart.opacity },
            { width: blobStart.width, height: blobStart.height, opacity: 0 }
          ],
          220
        );
      }

      pickers.forEach((picker, index) => {
        const mergedLeft = index === 0 ? slotWidth + gap / 2 - 28 : -gap / 2 - 28;
        const start = snapshots.get(picker);
        const merged = { left: `${mergedLeft}px`, width: "56px", height: "41.44px" };
        const expanded = { left: "0px", width: `${slotWidth}px`, height: "56px", opacity: 1 };
        if (next && !interrupted) {
          animate(
            picker,
            [
              { offset: 0, ...merged, opacity: 0 },
              { offset: 0.27, ...merged, opacity: 0, easing: "cubic-bezier(.42,0,.2,1)" },
              { offset: 0.4, opacity: 1 },
              {
                offset: 0.64,
                left: "6px",
                width: `${slotWidth - 12}px`,
                height: "49.28px",
                opacity: 1,
                easing: "cubic-bezier(.26,1.16,.72,1)"
              },
              { offset: 1, ...expanded }
            ],
            1300,
            "linear"
          );
        } else {
          animate(
            picker,
            [
              {
                left: start.left,
                width: start.width,
                height: start.height,
                opacity: start.opacity
              },
              next ? expanded : { ...merged, opacity: 1 }
            ],
            780,
            settleEase
          );
        }
      });
      outlines.forEach((element) => {
        animate(
          element,
          next && !interrupted
            ? [
                { offset: 0, opacity: 0 },
                { offset: 0.3, opacity: 0 },
                { offset: 0.46, opacity: 1 },
                { offset: 1, opacity: 1 }
              ]
            : [{ opacity: snapshots.get(element).opacity }, { opacity: next ? 1 : 0 }],
          next && !interrupted ? 1300 : 220,
          next && !interrupted ? ease : settleEase
        );
      });
      labels.forEach((element) => {
        animate(
          element,
          next && !interrupted
            ? [
                { offset: 0, opacity: 0 },
                { offset: 0.36, opacity: 0 },
                { offset: 1, opacity: 1 }
              ]
            : [{ opacity: snapshots.get(element).opacity }, { opacity: next ? 1 : 0 }],
          next ? 1300 : 120
        );
      });
      Promise.all(animations.map((animation) => animation.finished))
        .then(() => {
          if (revision !== token) return;
          animations.forEach((animation) => animation.cancel());
          animations = [];
        })
        .catch(() => {});
    }

    function update() {
      frame = 0;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight);
      const pickerBottom = Math.max(
        ...originals.map((select) => select.getBoundingClientRect().bottom)
      );
      const footerTop = footer?.getBoundingClientRect().top ?? Infinity;
      // 24px entry buffer; keep showing until the original actually re-enters.
      const next =
        pickerBottom < top - (visible ? 0 : 24) && footerTop > bottom + (visible ? 0 : 16);
      if (next !== visible) setVisible(next);
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener(
      "resize",
      () => {
        setVisible(visible, true);
        schedule();
      },
      { passive: true }
    );
    window.visualViewport?.addEventListener("scroll", schedule, { passive: true });
    window.visualViewport?.addEventListener("resize", schedule, { passive: true });
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(schedule);
      observer.observe(document.querySelector("main"));
      if (footer) observer.observe(footer);
    }
    reduce.addEventListener("change", () => {
      setVisible(visible, true);
      schedule();
    });
    update();
  }

  fetch("../assets/data/compare.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Unable to load comparison.");
      return response.json();
    })
    .then(({ models, groups }) => {
      if (!Array.isArray(models) || models.length < 2 || !Array.isArray(groups)) {
        throw new Error("Invalid comparison data.");
      }
      const byId = new Map(models.map((model) => [model.id, model]));
      let selected = [models[0].id, models[1].id];
      const floating = createFloatingPickers();
      const selectors = [
        [pickA, floating.copies[0]],
        [pickB, floating.copies[1]]
      ];

      function updateModel(side, model) {
        const image = document.getElementById(`img-${side}`);
        if (image.getAttribute("src") !== model.img) {
          image.hidden = true;
          image.onload = () => {
            image.hidden = false;
          };
          image.onerror = () => {
            image.hidden = true;
          };
          image.alt = `${model.name} Lock Screen preview`;
          image.src = model.img;
          if (image.complete && image.naturalWidth > 0) image.hidden = false;
        }
        iStageReleases.bind(document.getElementById(`download-${side}`), {
          version: model.id,
          supported: Boolean(model.learn),
          href: model.download
        });
        const learn = document.getElementById(`learn-${side}`);
        learn.hidden = !model.learn;
        if (model.learn) learn.href = model.learn;
        else learn.removeAttribute("href");
      }

      function render() {
        const [a, b] = selected.map((id) => byId.get(id));
        selectors.forEach((copies, index) =>
          copies.forEach((select) => {
            select.value = selected[index];
          })
        );
        updateModel("a", a);
        updateModel("b", b);
        let rowCount = 0;
        details.innerHTML = groups
          .map((group) => {
            const rows = group.rows;
            rowCount += rows.length;
            return `<section class="compare-group" aria-labelledby="group-${esc(group.id)}">
            <h3 class="body-heading" id="group-${esc(group.id)}">${esc(group.title)}</h3>
            <table class="compare-table" aria-labelledby="group-${esc(group.id)}">
              <thead class="compare-sr-only"><tr><th scope="col" id="model-a-${esc(group.id)}">${esc(a.name)}</th><th scope="col" id="model-b-${esc(group.id)}">${esc(b.name)}</th></tr></thead>
              ${rows.map((row) => `<tbody><tr><th colspan="2" id="feature-${esc(row.key)}">${esc(row.label)}</th></tr><tr><td headers="model-a-${esc(group.id)} feature-${esc(row.key)}">${renderValue(row.values[a.id])}</td><td headers="model-b-${esc(group.id)} feature-${esc(row.key)}">${renderValue(row.values[b.id])}</td></tr></tbody>`).join("")}
            </table>
          </section>`;
          })
          .join("");
        status.textContent = rowCount
          ? `${a.name} and ${b.name}: ${rowCount} features shown.`
          : "These versions have the same features in this comparison.";
      }

      selectors.forEach((copies, index) =>
        copies.forEach((select) => {
          select.innerHTML = models
            .map((model) => `<option value="${esc(model.id)}">${esc(model.name)}</option>`)
            .join("");
          select.disabled = false;
          select.addEventListener("change", () => {
            const next = select.value;
            if (!byId.has(next)) return;
            const other = 1 - index;
            if (next === selected[other]) selected[other] = selected[index];
            selected[index] = next;
            render();
          });
        })
      );
      render();
      initFloatingMotion(floating);
    })
    .catch(() => {
      status.setAttribute("role", "alert");
      status.classList.remove("compare-sr-only");
      status.textContent = "We couldn’t load the comparison. Please reload the page to try again.";
      pickA.disabled = true;
      pickB.disabled = true;
      document.querySelector(".compare-dock")?.remove();
    });
})();
