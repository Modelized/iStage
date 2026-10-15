import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import test from "node:test";

const docs = new URL("../docs/", import.meta.url);
const sources = new Map();
const htmlFiles = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) await collect(url);
    else if (entry.name.endsWith(".js")) sources.set(url.href, await readFile(url, "utf8"));
    else if (entry.name.endsWith(".html")) htmlFiles.push(url);
  }
}
await collect(docs);

const versions = new Map();
function resolveReference(reference, owner) {
  const url = new URL(reference, owner);
  const version = url.search;
  url.search = "";
  url.hash = "";
  if (versions.has(url.href)) {
    assert.equal(version, versions.get(url.href), `Mixed asset versions: ${url.href}`);
  }
  versions.set(url.href, version);
  return url;
}

test("JavaScript syntax, module paths and named exports", () => {
  for (const [file, source] of sources) {
    execFileSync(process.execPath, ["--input-type=module", "--check"], { input: source, stdio: "pipe" });
    for (const match of source.matchAll(/^import\s+(?:\{([^}]+)\}\s+from\s+)?["']([^"']+)["'];/gm)) {
      const target = resolveReference(match[2], file);
      assert.ok(sources.has(target.href), `Missing module: ${target.href}`);
      if (!match[1]) continue;
      const dependency = sources.get(target.href);
      const exported = new Set();
      for (const declaration of dependency.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/gm)) {
        exported.add(declaration[1]);
      }
      for (const list of dependency.matchAll(/^export\s*\{([^}]+)\}/gm)) {
        for (const name of list[1].split(",")) exported.add(name.trim().split(/\s+as\s+/).at(-1));
      }
      for (const name of match[1].split(",")) {
        assert.ok(exported.has(name.trim().split(/\s+as\s+/)[0]), `Missing export ${name} in ${target.href}`);
      }
    }
  }
});

test("Module dependencies have no cycles", () => {
  const visited = new Set();
  const active = new Set();
  function visit(file) {
    assert.ok(!active.has(file), `Circular dependency: ${file}`);
    if (visited.has(file)) return;
    active.add(file);
    for (const match of sources.get(file).matchAll(/^import\s+(?:\{[^}]+\}\s+from\s+)?["']([^"']+)["'];/gm)) {
      const target = resolveReference(match[1], file);
      assert.ok(sources.has(target.href), `Missing module: ${target.href}`);
      visit(target.href);
    }
    active.delete(file);
    visited.add(file);
  }
  for (const file of sources.keys()) visit(file);
});

test("Every page resolves local scripts and styles with consistent versions", async () => {
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
      const reference = match[1];
      if (/^(?:https?:)?\/\//.test(reference) || !/\.(?:js|css)(?:\?|$)/.test(reference)) continue;
      await access(resolveReference(reference, file));
    }
  }
});
