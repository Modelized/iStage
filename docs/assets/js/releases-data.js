/* Shared public release lookup and version download controls. */
const iStageReleases = (() => {
  let request;
  const controls = new Map();
  let availability;
  let failed = false;

  const versionFromTag = (tag = "") => /^v(\d+)(?:-beta)?$/i.exec(tag)?.[1] || "";

  function load() {
    if (!request) {
      request = (async () => {
        const releases = [];
        for (let page = 1; ; page++) {
          const response = await fetch(
            `https://api.github.com/repos/Modelized/iStage/releases?per_page=100&page=${page}`,
            {
              headers: { Accept: "application/vnd.github+json" },
              signal: AbortSignal.timeout(10000)
            }
          );
          if (!response.ok) throw new Error("Release lookup failed.");
          const batch = await response.json();
          if (!Array.isArray(batch)) throw new Error("Invalid release data.");
          releases.push(...batch.filter((release) => !release.draft));
          if (batch.length < 100) return releases;
        }
      })();
    }
    return request;
  }

  function render(control, config) {
    const { version, supported, href, label, buttonClasses } = config;
    const pending = !availability && !failed;
    const available = availability?.has(version);
    const unavailable = !pending && !failed && !available;
    const notice = unavailable && !supported;
    control.classList.toggle("download-unavailable", notice);
    buttonClasses.forEach((name) => control.classList.toggle(name, !notice));
    control.textContent = unavailable
      ? supported
        ? "Coming soon"
        : "Download is not available at this time."
      : label;
    if (pending || unavailable) {
      control.removeAttribute("href");
      control.setAttribute("aria-disabled", "true");
    } else {
      control.href = href;
      control.removeAttribute("aria-disabled");
    }
    if (pending) control.setAttribute("aria-busy", "true");
    else control.removeAttribute("aria-busy");
    if (failed) control.title = "Availability could not be checked. Open Releases to try again.";
    else control.removeAttribute("title");
  }

  function bind(control, { version, supported, href }) {
    const previous = controls.get(control);
    const config = {
      version: String(version),
      supported,
      href,
      label: previous?.label || control.textContent.trim(),
      buttonClasses:
        previous?.buttonClasses ||
        [...control.classList].filter((name) => name === "btn" || name.startsWith("btn-"))
    };
    const first = controls.size === 0;
    controls.set(control, config);
    render(control, config);
    if (first) {
      load()
        .then((releases) => {
          availability = new Set(
            releases
              .filter((release) => release.assets?.some((asset) => asset.browser_download_url))
              .map((release) => versionFromTag(release.tag_name))
              .filter(Boolean)
          );
        })
        .catch(() => {
          failed = true;
        })
        .then(() => {
          controls.forEach((value, element) => render(element, value));
        });
    }
  }

  document.querySelectorAll("[data-download-version]").forEach((control) => {
    bind(control, {
      version: control.dataset.downloadVersion,
      supported: control.hasAttribute("data-download-supported"),
      href: control.getAttribute("href")
    });
  });
  return { load, versionFromTag, bind };
})();
