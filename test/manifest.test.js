"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

test("uses Manifest V3 with no privileged extension permissions", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "SOOP 댓글 알림 필터");
  assert.equal(manifest.version, "1.0.4");
  assert.equal(manifest.permissions, undefined);
  assert.equal(manifest.host_permissions, undefined);
});

test("loads classifier before content script on SOOP HTTPS pages", () => {
  const script = manifest.content_scripts[0];
  assert.deepEqual(script.js, ["src/classifier.js", "src/content.js"]);
  assert.ok(script.matches.includes("https://www.sooplive.com/*"));
  assert.ok(script.matches.includes("https://*.sooplive.com/*"));
});

test("all manifest resources exist", () => {
  const script = manifest.content_scripts[0];
  [...script.js, ...script.css, ...Object.values(manifest.icons)].forEach((resource) => {
    assert.ok(fs.existsSync(path.join(root, resource)), resource);
  });
});
