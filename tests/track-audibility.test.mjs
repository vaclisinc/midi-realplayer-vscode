import assert from "node:assert/strict";
import test from "node:test";

import {
  getAudibleTrackIds,
  getEngineTrackIds,
  hasSoloedTracks,
  haveSameTrackIds,
  isTrackAudible,
  toggleTrackMute,
  toggleTrackSolo
} from "../webview/track-audibility.ts";

test("mute state controls audibility when no track is soloed", () => {
  const tracks = [
    { id: "lead", enabled: true, solo: false },
    { id: "pad", enabled: false, solo: false }
  ];

  assert.equal(hasSoloedTracks(tracks), false);
  assert.deepEqual([...getAudibleTrackIds(tracks)], ["lead"]);
});

test("solo mode never revives an invalid muted-and-soloed track", () => {
  const tracks = [
    { id: "lead", enabled: true, solo: false },
    { id: "pad", enabled: false, solo: true },
    { id: "bass", enabled: true, solo: true }
  ];

  assert.deepEqual([...getAudibleTrackIds(tracks)], ["bass"]);
  assert.equal(tracks[1].enabled, false);
  assert.equal(isTrackAudible(tracks[0], true), false);
});

test("soloing the only audible track does not change the playback route", () => {
  const tracks = [
    { id: "lead", enabled: true, solo: false },
    { id: "pad", enabled: false, solo: false }
  ];
  const before = getAudibleTrackIds(tracks);

  tracks[0].solo = true;
  const whileSoloed = getAudibleTrackIds(tracks);
  assert.equal(haveSameTrackIds(before, whileSoloed), true);

  tracks[0].solo = false;
  const after = getAudibleTrackIds(tracks);
  assert.equal(haveSameTrackIds(whileSoloed, after), true);
});

test("mute and solo are mutually exclusive on the same track", () => {
  const track = { id: "lead", enabled: true, solo: true };

  toggleTrackMute(track);
  assert.deepEqual(track, { id: "lead", enabled: false, solo: false });

  toggleTrackSolo(track);
  assert.deepEqual(track, { id: "lead", enabled: true, solo: true });

  toggleTrackSolo(track);
  assert.deepEqual(track, { id: "lead", enabled: true, solo: false });
});

test("an all-muted mix retains a timed engine sequence", () => {
  const tracks = [
    { id: "lead", enabled: false, solo: false },
    { id: "pad", enabled: false, solo: false }
  ];

  assert.deepEqual([...getAudibleTrackIds(tracks)], []);
  assert.deepEqual([...getEngineTrackIds(tracks)], ["lead", "pad"]);
});
