import assert from "node:assert/strict";
import test from "node:test";
import {
  collectTrackGains,
  updateTrackGain
} from "../webview/track-mixer.ts";

test("track gain is clamped and applied by stable track ID", () => {
  const tracks = [
    { id: "lead", gain: 1 },
    { id: "pad", gain: 1 }
  ];

  assert.equal(updateTrackGain(tracks, "lead", 0.42), true);
  assert.equal(tracks[0]?.gain, 0.42);
  assert.equal(tracks[1]?.gain, 1);

  updateTrackGain(tracks, "lead", 2);
  assert.equal(tracks[0]?.gain, 1);
});

test("separate tracks never link gain implicitly", () => {
  const tracks = [
    { id: "lead", gain: 1 },
    { id: "pad", gain: 1 }
  ];

  assert.equal(updateTrackGain(tracks, "pad", 0.25), true);
  assert.equal(tracks[0]?.gain, 1);
  assert.equal(tracks[1]?.gain, 0.25);
});

test("track gains serialize by track ID", () => {
  assert.deepEqual(
    collectTrackGains([
      { id: "track:1", gain: 0.7 },
      { id: "track:2", gain: 0.4 }
    ]),
    { "track:1": 0.7, "track:2": 0.4 }
  );
});
