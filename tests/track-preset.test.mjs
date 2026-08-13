import assert from "node:assert/strict";
import test from "node:test";
import {
  findPresetByKey,
  getDefaultTrackPreset,
  normalizeTrackPreset,
  presetKey
} from "../webview/track-preset.ts";

test("Choir Aahs defaults to the bundled Concert Choir preset", () => {
  assert.deepEqual(
    getDefaultTrackPreset({ program: 52, isDrums: false }),
    {
      bankMSB: 0,
      bankLSB: 0,
      program: 52,
      isGMGSDrum: false,
      name: "Concert Choir"
    }
  );
  assert.equal(
    getDefaultTrackPreset({ program: 53, isDrums: false }),
    null
  );
  assert.equal(
    getDefaultTrackPreset({ program: 52, isDrums: true }),
    null
  );
});

test("SoundFont patches have stable keys and can be restored", () => {
  const preset = {
    bankMSB: 2,
    bankLSB: 4,
    program: 53,
    isGMGSDrum: false,
    name: "Tight Voice"
  };
  assert.equal(presetKey(preset), "2:4:53:0");
  assert.equal(findPresetByKey([preset], "2:4:53:0"), preset);
  assert.deepEqual(normalizeTrackPreset(preset), preset);
  assert.equal(normalizeTrackPreset(null), null);
});
