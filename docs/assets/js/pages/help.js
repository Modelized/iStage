"use strict";

(function () {
  const toggles = Array.from(document.querySelectorAll(".acc-toggle"));

  toggles.forEach((button) => {
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      const panel = document.getElementById(button.getAttribute("aria-controls"));

      button.setAttribute("aria-expanded", String(!expanded));
      if (!panel) {
        return;
      }

      if (expanded) {
        panel.hidden = true;
        panel.style.gridTemplateRows = "0fr";
      } else {
        panel.hidden = false;
        requestAnimationFrame(() => {
          panel.style.gridTemplateRows = "1fr";
        });
      }
    });
  });

  document.querySelectorAll(".accordion .card.reveal-onload").forEach((card, index) => {
    card.style.animationDelay = `${0.12 + 0.08 * index}s`;
  });
})();
