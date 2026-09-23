"use strict";

// State/stylesheet contract tests; these do not replace browser visual review.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const read = (file) => readFileSync(path.join(__dirname, "../" + file), "utf8");
const source = read("docs/assets/js/popup-motion.js");
const css = read("docs/assets/css/popup-motion.css");

function setup(reduced = false) {
  let id = 0;
  let flushes = 0;
  const timers = new Map();
  const frames = new Map();
  const media = {
    matches: reduced,
    addEventListener: (_, callback) => {
      media.change = callback;
    }
  };
  class Element {
    constructor() {
      this.classes = new Set();
      this.attributes = {};
      this.listeners = {};
      this.style = {
        setProperty: (key, value) => {
          this.style[key] = value;
        }
      };
      this.classList = {
        add: (...names) => names.forEach((name) => this.classes.add(name)),
        remove: (...names) => names.forEach((name) => this.classes.delete(name)),
        toggle: (name, value) => (value ? this.classes.add(name) : this.classes.delete(name)),
        contains: (name) => this.classes.has(name)
      };
    }
    get offsetWidth() {
      flushes++;
      return 288;
    }
    setAttribute(key, value) {
      this.attributes[key] = value;
    }
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    }
    contains(element) {
      return element === primary;
    }
  }
  const root = new Element();
  const primary = new Element();
  const items = Array.from({ length: 7 }, () => new Element());
  root.querySelector = () => primary;
  root.querySelectorAll = () => items;
  const document = { activeElement: null };
  const context = vm.createContext({
    window: {},
    document,
    matchMedia: () => media,
    getComputedStyle: () => ({
      animationDuration: "1.3s",
      animationDelay: "0s",
      transitionDuration: "0.22s, 0.66s",
      transitionDelay: "0.58s, 0.52s"
    }),
    setTimeout: (callback, delay) => {
      timers.set(++id, { callback, delay });
      return id;
    },
    clearTimeout: (key) => timers.delete(key),
    requestAnimationFrame: (callback) => {
      frames.set(++id, callback);
      return id;
    },
    cancelAnimationFrame: (key) => frames.delete(key)
  });
  vm.runInContext(source, context);
  const motion = context.window.createPopupMotion(root);
  const endIntro = () =>
    root.listeners.animationend({
      target: primary,
      animationName: "popup-primary-split"
    });
  const paint = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback());
  };
  const endExit = () => root.listeners.transitionend({ target: root, propertyName: "transform" });
  return {
    root,
    primary,
    items,
    motion,
    media,
    document,
    timers,
    frames,
    endIntro,
    paint,
    endExit,
    flushes: () => flushes
  };
}

test("intro uses CSS classes, finishes at the mounted endpoint and clears pending work", () => {
  const scene = setup();
  assert.equal(scene.root.inert, true);
  assert.equal(scene.root.attributes["aria-hidden"], "true");
  scene.motion.setVisible(true);
  assert.equal(scene.root.inert, false);
  assert(scene.root.classes.has("is-introducing"));
  assert(scene.root.classes.has("is-mounted"));
  assert.deepEqual(
    scene.items.map((item) => item.style["--popup-item-index"]),
    [0, 1, 2, 3, 4, 5, 6]
  );
  assert.equal([...scene.timers.values()][0].delay, 1400);
  scene.root.listeners.animationend({ target: scene.primary, animationName: "popup-outline" });
  assert(scene.root.classes.has("is-introducing"));
  scene.endIntro();
  assert(!scene.root.classes.has("is-introducing"));
  assert(scene.root.classes.has("is-intro-settling"));
  scene.paint();
  assert(!scene.root.classes.has("is-intro-settling"));
  assert(scene.root.classes.has("is-mounted"));
  assert.equal(scene.timers.size, 0);
  assert.equal(scene.frames.size, 0);
  assert.equal(scene.flushes(), 1);
});

test("a hide during the intro is buffered without detaching the running keyframes", () => {
  const scene = setup();
  scene.motion.setVisible(true);
  scene.motion.setVisible(false);
  assert.equal(scene.root.inert, true);
  assert(scene.root.classes.has("is-introducing"));
  assert(scene.root.classes.has("is-mounted"));
  scene.endIntro();
  scene.paint();
  assert(!scene.root.classes.has("is-mounted"));
  assert.equal([...scene.timers.values()][0].delay, 1280);
  scene.endExit();
  assert.equal(scene.timers.size, 0);
  scene.motion.setVisible(true);
  assert(scene.root.classes.has("is-introducing"));
});

test("only the latest request survives intro/settling; exit reversal does not restart the intro", () => {
  const scene = setup();
  scene.motion.setVisible(true);
  scene.motion.setVisible(false);
  scene.endIntro();
  scene.motion.setVisible(true);
  scene.paint();
  assert(scene.root.classes.has("is-mounted"));
  assert.equal(scene.timers.size, 0);
  scene.motion.setVisible(false);
  assert(!scene.root.classes.has("is-mounted"));
  scene.motion.setVisible(true);
  assert(scene.root.classes.has("is-mounted"));
  assert(!scene.root.classes.has("is-introducing"));
  assert.equal(scene.timers.size, 0);
  scene.endExit(); // A stale transition end must not mark an open popup hidden.
  scene.motion.setVisible(false);
  scene.motion.setVisible(true);
  assert(!scene.root.classes.has("is-introducing"));
});

test("reduced motion settles queued requests immediately and disables hidden keyboard targets", () => {
  const scene = setup();
  scene.motion.setVisible(true);
  let blurred = false;
  scene.primary.blur = () => {
    blurred = true;
  };
  scene.document.activeElement = scene.primary;
  scene.motion.setVisible(false);
  assert(blurred);
  scene.media.matches = true;
  scene.media.change();
  assert(!scene.root.classes.has("is-mounted"));
  assert(!scene.root.classes.has("is-introducing"));
  assert.equal(scene.timers.size, 0);
  assert.equal(scene.frames.size, 0);
  scene.motion.setVisible(true);
  assert(scene.root.classes.has("is-mounted"));
  assert(!scene.root.classes.has("is-introducing"));
  scene.motion.setVisible(false);
  assert.equal(scene.root.inert, true);
});

test("fallback completes the CSS handoff if animationend is unavailable", () => {
  const scene = setup();
  scene.motion.setVisible(true);
  scene.motion.setVisible(false);
  [...scene.timers.values()][0].callback();
  scene.paint();
  assert(!scene.root.classes.has("is-mounted"));
  [...scene.timers.values()][0].callback();
  scene.motion.setVisible(true);
  assert(scene.root.classes.has("is-introducing"));
});

test("both pages use the shared stylesheet/controller without WAAPI or path-based glass layers", () => {
  assert(!source.includes(".animate("));
  assert(!source.includes("clipPath"));
  assert(!source.includes("measure("));
  assert(!css.includes("clip-path"));
  assert(!css.includes(".popup-glass"));
  assert(!css.includes(".popup-shadow"));
  assert.match(css, /--popup-size: 56px/);
  assert.match(css, /transition-delay: var\(--popup-outline-exit\)/);
  assert.match(css, /opacity var\(--popup-outline-exit\)/);
  assert(!css.includes("41.44px"));
  assert(!css.includes("49.28px"));
  for (const page of ["compare", "iStage-27"]) {
    const html = read("docs/" + page + "/index.html");
    assert(
      html.indexOf("assets/js/popup-motion.js") < html.indexOf("assets/js/pages/" + page + ".js")
    );
    assert(html.includes("assets/css/popup-motion.css"));
    assert(read("docs/assets/js/pages/" + page + ".js").includes("createPopupMotion("));
  }
  const compare = read("docs/assets/css/pages/compare.css");
  assert(compare.includes("--popup-secondary-width: var(--popup-primary-width)"));
  assert(compare.includes("--popup-surface: var(--compare-dock-surface)"));
  assert(compare.includes("@media (prefers-color-scheme: dark)"));
});
