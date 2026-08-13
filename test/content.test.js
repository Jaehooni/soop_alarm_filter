"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.resolve(__dirname, "../src/content.js"),
  "utf8"
);

test("targets only confirmed SOOP date notification lists", () => {
  assert.match(source, /ul\[class\*='notification-module_list__' i\]/);
  assert.doesNotMatch(source, /\[class\*='notification' i\]/);
  assert.doesNotMatch(source, /\[aria-label\*='알림'\]/);
});

test("does not observe unrelated page attribute changes", () => {
  assert.match(source, /childList:\s*true/);
  assert.doesNotMatch(source, /attributes:\s*true/);
  assert.doesNotMatch(source, /attributeFilter/);
  assert.match(source, /mutation\.target\.closest\(LIST_SELECTOR\)/);
});
