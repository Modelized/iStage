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
        pickA.value = a.id;
        pickB.value = b.id;
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

      [pickA, pickB].forEach((select, index) => {
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
      });
      render();
    })
    .catch(() => {
      status.setAttribute("role", "alert");
      status.classList.remove("compare-sr-only");
      status.textContent = "We couldn’t load the comparison. Please reload the page to try again.";
      pickA.disabled = true;
      pickB.disabled = true;
    });
})();
