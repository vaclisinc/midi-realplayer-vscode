import assert from "node:assert/strict";
import test from "node:test";
import { getInstrumentThumbnailIndex } from "../webview/instrument-thumbnails.ts";

test("General MIDI families map to their sprite cells", () => {
  const families = [
    "piano",
    "chromatic percussion",
    "organ",
    "guitar",
    "bass",
    "strings",
    "ensemble",
    "brass",
    "reed",
    "pipe",
    "synth lead",
    "synth pad",
    "synth effects",
    "world",
    "percussive",
    "sound effects"
  ];

  assert.deepEqual(
    families.map((family) => getInstrumentThumbnailIndex(family, false)),
    families.map((_, index) => index)
  );
});

test("drum channels always use the percussion thumbnail", () => {
  assert.equal(getInstrumentThumbnailIndex("piano", true), 14);
});

test("unknown families use the studio effects fallback thumbnail", () => {
  assert.equal(getInstrumentThumbnailIndex("unknown", false), 12);
});
