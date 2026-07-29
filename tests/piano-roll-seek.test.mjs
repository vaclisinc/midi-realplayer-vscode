import assert from "node:assert/strict";
import test from "node:test";
import { resolvePianoRollSeek } from "../webview/piano-roll-seek.ts";

const adjacentNotes = [
  {
    enabled: true,
    notes: [
      { midi: 60, time: 1, duration: 0.5 },
      { midi: 60, time: 1.5, duration: 0.5 }
    ]
  }
];

test("clicking inside a note seeks to that note's onset", () => {
  assert.deepEqual(resolvePianoRollSeek(adjacentNotes, 1.3, 60), {
    displayTime: 1,
    engineTime: 0.996,
    snappedToNote: true
  });
});

test("an adjacent note owns its exact onset boundary", () => {
  assert.deepEqual(resolvePianoRollSeek(adjacentNotes, 1.5, 60), {
    displayTime: 1.5,
    engineTime: 1.496,
    snappedToNote: true
  });
});

test("disabled and different-pitch notes do not capture the click", () => {
  assert.deepEqual(
    resolvePianoRollSeek(
      [{ enabled: false, notes: adjacentNotes[0].notes }],
      1.3,
      60
    ),
    {
      displayTime: 1.3,
      engineTime: 1.3,
      snappedToNote: false
    }
  );
  assert.equal(resolvePianoRollSeek(adjacentNotes, 1.3, 61).snappedToNote, false);
});

test("clicking outside note rows remains a free timeline seek", () => {
  assert.deepEqual(resolvePianoRollSeek(adjacentNotes, 1.3), {
    displayTime: 1.3,
    engineTime: 1.3,
    snappedToNote: false
  });
});
