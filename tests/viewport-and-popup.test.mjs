import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
const viewportSource = await readFile(new URL("../docs/assets/js/modules/viewport.js", import.meta.url), "utf8");
const { normalizeViewport } = await import(`data:text/javascript;base64,${Buffer.from(viewportSource).toString("base64")}`);

const viewport = { scrollY: 0, scrollHeight: 2400, clientHeight: 800, height: 800 };

test("Rubber-band displacement does not move the section's visibility threshold", () => {
  for (const scrollY of [0, -30, -180]) {
    const { bottom, overscroll } = normalizeViewport({ ...viewport, scrollY });
    assert.equal(720 - scrollY + overscroll < bottom, true, "Visible highlights stay available");
    assert.equal(900 - scrollY + overscroll < bottom, false, "Offscreen highlights stay hidden");
  }
  const { bottom, overscroll } = normalizeViewport({ ...viewport, scrollY: 1720 });
  assert.equal(2400 - 1720 + overscroll, bottom, "Bottom rubber-banding is normalized too");
});

test("Visual viewport offsets preserve zoom bounds without accepting rubber-band offsets", () => {
  assert.deepEqual(normalizeViewport({ ...viewport, height: 500, offsetTop: 100 }),
    { top: 100, bottom: 600, overscroll: 0 });
  assert.deepEqual(normalizeViewport({ ...viewport, offsetTop: -100 }),
    { top: 0, bottom: 800, overscroll: 0 });
  assert.deepEqual(normalizeViewport({ ...viewport, scrollHeight: 400, scrollY: -40 }),
    { top: 0, bottom: 800, overscroll: -40 });
});

function classList() {
  const names = new Set();
  return {
    add: (...values) => values.forEach((name) => names.add(name)),
    remove: (...values) => values.forEach((name) => names.delete(name)),
    contains: (name) => names.has(name),
    toggle(name, force = !names.has(name)) {
      if (force) names.add(name); else names.delete(name);
      return force;
    }
  };
}

const popupSource = await readFile(new URL("../docs/assets/js/popup-motion.js", import.meta.url), "utf8");
function popupHarness() {
  const callbacks = new Map();
  const listeners = new Map();
  const attrs = new Map();
  const document = {
    documentElement: { classList: classList() },
    addEventListener: (name, handler) => listeners.set(name, handler),
    activeElement: null
  };
  const root = {
    classList: classList(),
    querySelector: () => ({ addEventListener() {} }),
    querySelectorAll: () => [],
    contains: () => false,
    setAttribute: (name, value) => attrs.set(name, value)
  };
  let id = 0;
  const createPopupMotion = runInNewContext(
    popupSource.replace("export const createPopupMotion", "const createPopupMotion") + "\ncreatePopupMotion;",
    {
      document,
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      requestAnimationFrame: (fn) => { callbacks.set(++id, fn); return id; },
      cancelAnimationFrame: (key) => callbacks.delete(key)
    }
  );
  const motion = createPopupMotion(root);
  const flush = () => {
    for (let i = 0; callbacks.size && i < 10; i++) {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((fn) => fn());
    }
    assert.equal(callbacks.size, 0);
  };
  const menu = (open) => {
    document.documentElement.classList.toggle("menu-open", open);
    listeners.get("nav:toggle")();
    flush();
  };
  return { root, attrs, motion, menu, flush };
}

test("A docked bar stays mounted through navigation and remains noninteractive behind it", () => {
  const { root, attrs, motion, menu, flush } = popupHarness();
  motion.setVisible(true);
  motion.setDocked(true);
  flush();
  menu(true);
  assert.equal(root.classList.contains("is-mounted"), true);
  assert.equal(root.inert, true);
  assert.equal(attrs.get("aria-hidden"), "true");
  menu(false);
  assert.equal(root.classList.contains("is-mounted"), true);
  assert.equal(root.inert, false);
  assert.equal(attrs.get("aria-hidden"), "false");
});

test("An undocked bar hides for navigation, and docking never reveals an unavailable bar", () => {
  const { root, motion, menu, flush } = popupHarness();
  motion.setVisible(true);
  flush();
  menu(true);
  assert.equal(root.classList.contains("is-mounted"), false);
  menu(false);
  assert.equal(root.classList.contains("is-mounted"), true);
  motion.setVisible(false);
  motion.setDocked(true);
  flush();
  menu(true);
  menu(false);
  assert.equal(root.classList.contains("is-mounted"), false);
});
