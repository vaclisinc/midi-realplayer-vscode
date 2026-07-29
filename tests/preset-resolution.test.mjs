import assert from "node:assert/strict";
import test from "node:test";
import { resolvePreset } from "../webview/preset-resolution.ts";

const piano = {
  name: "Concert Grand",
  bankMSB: 0,
  bankLSB: 0,
  program: 0,
  isGMGSDrum: false,
  isDrum: false
};

const violin = {
  name: "Solo Violin",
  bankMSB: 0,
  bankLSB: 0,
  program: 40,
  isGMGSDrum: false,
  isDrum: false
};

test("an exact SoundFont preset is not reported as a fallback", () => {
  assert.deepEqual(
    resolvePreset([piano, violin], violin, "gs"),
    { name: "Solo Violin", fallback: false }
  );
});

test("a missing MIDI program reports the actual fallback preset", () => {
  assert.deepEqual(
    resolvePreset(
      [piano],
      {
        bankMSB: 0,
        bankLSB: 0,
        program: 40,
        isGMGSDrum: false
      },
      "gs"
    ),
    { name: "Concert Grand", fallback: true }
  );
});

test("an empty SoundFont preset list has no resolution", () => {
  assert.equal(
    resolvePreset(
      [],
      {
        bankMSB: 0,
        bankLSB: 0,
        program: 0,
        isGMGSDrum: false
      },
      "gs"
    ),
    undefined
  );
});
