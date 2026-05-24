import test from "node:test";
import assert from "node:assert/strict";
import { normalizePalette, sanitizeFileName } from "../src/core.js";

test("sanitizeFileName keeps browser-safe names", () => {
  assert.equal(sanitizeFileName("blue slime idle!"), "blue_slime_idle");
  assert.equal(sanitizeFileName(""), "asset");
});

test("normalizePalette filters invalid colors and falls back", () => {
  assert.deepEqual(normalizePalette("#000000, nope, #ffffff"), ["#000000", "#FFFFFF"]);
  assert.ok(normalizePalette("bad").length >= 3);
});
