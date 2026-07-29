import assert from "node:assert/strict";
import test from "node:test";
import { getActiveNotesAtTime } from "../webview/note-chase.ts";

const tracks = [
  {
    enabled: true,
    sourceChannel: 4,
    notes: [
      { midi: 60, time: 1, duration: 2, velocity: 0.5 },
      { midi: 64, time: 3, duration: 1, velocity: 1 }
    ]
  }
];

test("notes sounding across a seek point are chased", () => {
  assert.deepEqual(getActiveNotesAtTime(tracks, 2), [
    { channel: 4, midi: 60, velocity: 64 }
  ]);
});

test("notes at their exact onset are left for the sequencer", () => {
  assert.deepEqual(getActiveNotesAtTime(tracks, 1), []);
  assert.deepEqual(getActiveNotesAtTime(tracks, 3), []);
});

test("notes at or after their offset are not chased", () => {
  assert.deepEqual(getActiveNotesAtTime(tracks, 3.5), [
    { channel: 4, midi: 64, velocity: 127 }
  ]);
  assert.deepEqual(getActiveNotesAtTime(tracks, 4), []);
});

test("disabled tracks and tracks without a MIDI channel stay silent", () => {
  const notes = [{ midi: 48, time: 0, duration: 10, velocity: 0.8 }];
  assert.deepEqual(
    getActiveNotesAtTime(
      [
        { enabled: false, sourceChannel: 1, notes },
        { enabled: true, notes }
      ],
      5
    ),
    []
  );
});

test("very low nonzero velocities remain playable", () => {
  assert.deepEqual(
    getActiveNotesAtTime(
      [
        {
          enabled: true,
          sourceChannel: 2,
          notes: [{ midi: 36, time: 0, duration: 2, velocity: 0.001 }]
        }
      ],
      1
    ),
    [{ channel: 2, midi: 36, velocity: 1 }]
  );
});
