import assert from "node:assert/strict";
import test from "node:test";
import {
  getInstrumentFamilyClass,
  getInstrumentFamilyColor,
  getInstrumentFamilyPalette,
  getInstrumentThumbnailIndex,
  resolveInstrumentFamily
} from "../webview/instrument-thumbnails.ts";

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

test("empty tracks use their MIDI track name as a visual fallback", () => {
  assert.equal(
    resolveInstrumentFamily("piano", false, "guitar", false),
    "guitar"
  );
  assert.equal(
    resolveInstrumentFamily("piano", false, "Lead Guitar", false),
    "guitar"
  );
  assert.equal(
    resolveInstrumentFamily("piano", false, "Untitled Track", false),
    "piano"
  );
});

test("tracks with notes keep their MIDI program family", () => {
  assert.equal(
    resolveInstrumentFamily("bass", false, "guitar", true),
    "bass"
  );
  assert.equal(
    resolveInstrumentFamily("piano", true, "keys", false),
    "percussion"
  );
});

test("instrument families map to CSP-safe track palette classes", () => {
  assert.equal(getInstrumentFamilyClass("bass", false), "bass");
  assert.equal(getInstrumentFamilyClass("piano", true), "percussion");
  assert.equal(getInstrumentFamilyClass("unknown", false), "sound-effects");
});

test("instrument families receive stable semantic colors", () => {
  assert.equal(
    getInstrumentFamilyColor("piano", false),
    "rgb(78, 135, 212)"
  );
  assert.equal(
    getInstrumentFamilyColor("bass", false),
    "rgb(50, 166, 151)"
  );
  assert.notEqual(
    getInstrumentFamilyColor("piano", false),
    getInstrumentFamilyColor("guitar", false)
  );
});

test("instruments in one family receive nearby lightness variants", () => {
  assert.equal(
    getInstrumentFamilyColor("piano", false, 1),
    "rgb(66, 123, 200)"
  );
  assert.equal(
    getInstrumentFamilyColor("piano", false, 2),
    "rgb(90, 147, 224)"
  );
});

test("track UI palettes use broadly supported precomputed sRGB colors", () => {
  const palette = getInstrumentFamilyPalette("guitar", false);
  assert.equal(palette.solid, "rgb(215, 154, 52)");
  assert.equal(palette.surface, "rgba(215, 154, 52, 0.46)");
  assert.equal(palette.border, "rgba(215, 154, 52, 0.9)");
  assert.doesNotMatch(Object.values(palette).join(" "), /oklch|color-mix/);
});

test("drums always use the percussion family color", () => {
  assert.equal(
    getInstrumentFamilyColor("piano", true),
    getInstrumentFamilyColor("percussion", false)
  );
});
