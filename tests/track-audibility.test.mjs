import assert from "node:assert/strict";
import test from "node:test";

import {
  getAudibleTrackIds,
  hasSoloedTracks,
  isTrackAudible
} from "../webview/track-audibility.ts";

test("mute state controls audibility when no track is soloed", () => {
  const tracks = [
    { id: "lead", enabled: true, solo: false },
    { id: "pad", enabled: false, solo: false }
  ];

  assert.equal(hasSoloedTracks(tracks), false);
  assert.deepEqual([...getAudibleTrackIds(tracks)], ["lead"]);
});

test("solo temporarily overrides mute without changing the saved mute state", () => {
  const tracks = [
    { id: "lead", enabled: true, solo: false },
    { id: "pad", enabled: false, solo: true },
    { id: "bass", enabled: true, solo: true }
  ];

  assert.deepEqual([...getAudibleTrackIds(tracks)], ["pad", "bass"]);
  assert.equal(tracks[1].enabled, false);
  assert.equal(isTrackAudible(tracks[0], true), false);
});
