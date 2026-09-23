"use strict";

// DOM/WAAPI contract tests only; these do not claim browser rendering coverage.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const source = readFileSync(path.join(__dirname, "../docs/assets/js/popup-motion.js"), "utf8");

function setup({ width = 288, compare = false, reduced = false, animate = true } = {}) {
  const allAnimations = [];
  const listeners = {};
  const media = {
    matches: reduced,
    addEventListener: (_, fn) => {
      media.change = fn;
    }
  };
  class Element {
    constructor() {
      this.style = {};
      this.sample = {};
      this.children = [];
      this.attributes = {};
      this.classes = new Set();
      this.classList = {
        add: (name) => this.classes.add(name),
        toggle: (name, on) => (on ? this.classes.add(name) : this.classes.delete(name))
      };
    }
    append(...children) {
      this.children.push(...children);
    }
    setAttribute(key, value) {
      this.attributes[key] = value;
    }
    getBoundingClientRect() {
      return { width, height: 56 };
    }
    contains(element) {
      return this.children.includes(element);
    }
    animate(frames, options) {
      const animation = { element: this, frames, options, cancelled: false };
      animation.finished = new Promise((resolve, reject) => {
        animation.finish = resolve;
        animation.cancel = () => {
          animation.cancelled = true;
          reject(Error("cancelled"));
        };
      });
      allAnimations.push(animation);
      return animation;
    }
  }
  const root = new Element();
  if (!animate) root.animate = null;
  const controls = [new Element(), new Element()];
  root.append(...controls);
  const group = new Element();
  group.style["--popup-content-width"] = "172px";
  group.style["--popup-content-collapsed-width"] = "46px";
  const icon = new Element();
  const items = Array.from({ length: 7 }, () => new Element());
  const document = {
    createElement: () => new Element(),
    timeline: { currentTime: 100 },
    activeElement: null
  };
  const context = vm.createContext({
    window: {
      addEventListener: (event, fn) => {
        listeners[event] = fn;
      }
    },
    document,
    matchMedia: () => media,
    getComputedStyle: (element) =>
      new Proxy(
        {},
        {
          get: (_, key) =>
            key === "getPropertyValue"
              ? (property) => element.style[property] || ""
              : (element.sample[key] ??
                element.style[key] ??
                {
                  opacity: "1",
                  transform: "none",
                  clipPath: "none",
                  left: "0px",
                  width: "56px",
                  height: "56px"
                }[key])
        }
      )
  });
  vm.runInContext(source, context);
  const motion = context.window.createPopupMotion({
    root,
    controls,
    content: compare
      ? [{ element: group }, { element: icon }]
      : [
          { element: group, type: "unfold", items },
          { element: icon, type: "scale" }
        ],
    measure: (w, size) =>
      compare
        ? [
            { left: 0, width: (w - 24) / 2 },
            { left: (w + 24) / 2, width: (w - 24) / 2 }
          ]
        : [
            { left: 0, width: 216 },
            { left: w - size, width: size }
          ]
  });
  const part = (name) => root.children.filter((element) => element.className === name);
  const live = () => allAnimations.filter((animation) => !animation.cancelled);
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };
  const finish = async () => {
    live().forEach((animation) => animation.finish());
    await flush();
  };
  return {
    root,
    controls,
    group,
    icon,
    items,
    media,
    listeners,
    motion,
    part,
    live,
    finish,
    flush,
    document,
    setWidth: (value) => {
      width = value;
    }
  };
}

test("both layouts use the same entrance timeline and a 56px merged circle", async () => {
  const layouts = [
    setup(),
    setup({ width: 346.5, compare: true }),
    setup({ width: 1200, compare: true })
  ];
  let rise;
  for (const scene of layouts) {
    assert.equal(scene.root.inert, true);
    for (const control of scene.controls) {
      assert.equal(control.style.width, "56px");
      assert.equal(control.style.height, "56px");
    }
    scene.motion.setVisible(true);
    assert.equal(scene.root.inert, false);
    assert.equal(scene.root.attributes["aria-hidden"], "false");
    const tracks = scene.live();
    assert.ok(tracks.every((track) => track.startTime === 100));
    const rootTrack = tracks.find(
      (track) => track.element === scene.root && "transform" in track.frames[0]
    );
    const serialized = JSON.stringify({ frames: rootTrack.frames, options: rootTrack.options });
    if (rise) assert.equal(serialized, rise);
    rise = serialized;
    assert.equal(rootTrack.options.duration, 1200);
    const glass = scene.part("popup-glass");
    assert.equal(glass.length, 1);
    const glassTrack = tracks.find(
      (track) => track.element === glass[0] && "clipPath" in track.frames[0]
    );
    assert.equal(glassTrack.options.duration, 1300);
    for (const frame of glassTrack.frames)
      assert.equal((frame.clipPath.match(/M /g) || []).length, 2);
    await scene.finish();
    assert.equal(scene.live().length, 0);
    assert.equal(scene.root.style.opacity, 1);
    scene.controls.forEach((control) => assert.equal(control.style.height, "56px"));
  }
});

test("glass and controls share split geometry; shadow seams never overlap", () => {
  for (const compare of [false, true]) {
    const scene = setup({ width: compare ? 360 : 288, compare });
    scene.motion.setVisible(true);
    const shadows = scene.part("popup-shadow");
    const shadowTracks = shadows.map((element) =>
      scene.live().find((track) => track.element === element && "clipPath" in track.frames[0])
    );
    const controlTracks = scene.controls.map((element) =>
      scene.live().find((track) => track.element === element && "left" in track.frames[0])
    );
    for (let frame = 0; frame < 4; frame++) {
      const [a, b] = shadowTracks.map((track) => track.frames[frame]);
      const insetA = Number(a.clipPath.match(/inset\(-64px ([\d.-]+)px/)[1]);
      const insetB = Number(b.clipPath.match(/ ([\d.-]+)px\)$/)[1]);
      assert.ok(
        Math.abs(parseFloat(a.left) + parseFloat(a.width) - insetA - parseFloat(b.left) - insetB) <
          1e-8
      );
      controlTracks.forEach((track, index) => {
        for (const key of ["left", "width", "height", "offset", "easing"]) {
          assert.equal(track.frames[frame][key], shadowTracks[index].frames[frame][key]);
        }
      });
    }
  }
});

test("closing fades outlines before the merge and preserves dot choreography", async () => {
  const scene = setup();
  scene.motion.setVisible(true);
  const dots = scene.items.map((element) =>
    scene.live().find((track) => track.element === element)
  );
  assert.deepEqual(
    dots.map((track) => track.options.delay),
    [460, 510, 560, 610, 660, 710, 760]
  );
  await scene.finish();
  scene.motion.setVisible(false);
  const outline = scene.controls[0].children.find(
    (element) => element.className === "popup-outline"
  );
  const fade = scene.live().find((track) => track.element === outline);
  assert.equal(fade.options.duration, 220);
  assert.equal(fade.options.delay, 0);
  assert.equal(fade.frames[1].opacity, 0);
  const shape = scene.live().find((track) => track.element === scene.controls[0]);
  assert.equal(shape.options.duration, 780);
  assert.equal(shape.frames[1].width, "56px");
  await scene.finish();
  assert.equal(scene.root.inert, true);
});

test("rapid direction reversals snapshot the visible frame and ignore stale completions", async () => {
  const scene = setup();
  scene.motion.setVisible(true);
  const first = scene.live();
  scene.controls[0].sample = { left: "86px", width: "99px", height: "56px" };
  scene.root.sample = { transform: "matrix(1, 0, 0, 1, -144, 15)", opacity: ".82" };
  scene.motion.setVisible(false);
  assert.ok(first.every((track) => track.cancelled));
  const closing = scene.live();
  assert.equal(
    closing.find((track) => track.element === scene.controls[0]).frames[0].width,
    "99px"
  );
  assert.equal(
    closing.find((track) => track.element === scene.root && "transform" in track.frames[0])
      .frames[0].transform,
    scene.root.sample.transform
  );
  assert.ok(closing.every((track) => track.options.delay === 0));
  scene.motion.setVisible(true);
  const count = scene.live().length;
  await scene.flush();
  assert.equal(scene.live().length, count);
  assert.ok(closing.every((track) => track.cancelled));
  scene.motion.setVisible(true);
  assert.equal(scene.live().length, count, "same visibility is a no-op");
  await scene.finish();
  assert.equal(scene.root.inert, false);
});

test("resize and reduced motion settle without orphan animations", async () => {
  const scene = setup({ width: 360, compare: true });
  scene.motion.setVisible(true);
  scene.setWidth(600);
  scene.listeners.resize();
  assert.equal(scene.controls[0].style.width, "288px");
  assert.equal(scene.live().length, 0);
  scene.motion.setVisible(false);
  scene.media.matches = true;
  scene.media.change();
  assert.equal(scene.live().length, 0);
  scene.motion.setVisible(true);
  assert.equal(scene.live().length, 0);
  assert.equal(scene.root.style.opacity, 1);
  await scene.flush();
  for (const options of [{ reduced: true }, { animate: false }]) {
    const fallback = setup(options);
    fallback.motion.setVisible(true);
    assert.equal(fallback.live().length, 0);
    assert.equal(fallback.controls[0].style.width, "216px");
  }
});
