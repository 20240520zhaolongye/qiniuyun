import test from "node:test";
import assert from "node:assert/strict";
import { normalizePalette, parseSize, sanitizeFileName } from "../src/core.js";

test("parseSize parses valid sizes", () => {
  assert.deepEqual(parseSize("64x32"), { width: 64, height: 32 });
  assert.throws(() => parseSize("64"), /Invalid size/);
});

test("sanitizeFileName keeps safe names", () => {
  assert.equal(sanitizeFileName("blue slime idle!"), "blue_slime_idle");
  assert.equal(sanitizeFileName(""), "asset");
});

test("normalizePalette filters invalid colors", () => {
  assert.deepEqual(normalizePalette("#000000, nope, #ffffff"), ["#000000", "#ffffff"]);
});
