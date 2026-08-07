import assert from "node:assert/strict";
import test from "node:test";
import {
  getArrangementCanvasHeight,
  getArrangementNoteRect,
  getPianoRollCanvasHeight
} from "../webview/arrangement-view.ts";

test("arrangement canvas grows with track height", () => {
  assert.equal(getArrangementCanvasHeight(10, 80, 28, 500), 828);
  assert.equal(getArrangementCanvasHeight(2, 80, 28, 500), 500);
});

test("piano roll canvas grows when pitch rows are enlarged", () => {
  assert.equal(getPianoRollCanvasHeight(88, 12, 28, 600), 1084);
  assert.equal(getPianoRollCanvasHeight(24, 8, 28, 600), 600);
});

test("arrangement notes use time horizontally and local pitch vertically", () => {
  const notes = [
    { midi: 48, time: 1, duration: 2 },
    { midi: 60, time: 4, duration: 1 }
  ];
  const rect = getArrangementNoteRect(
    notes[0],
    48,
    60,
    1,
    80,
    28,
    1000,
    0,
    10
  );

  assert.equal(rect.x, 100);
  assert.equal(rect.width, 200);
  assert.ok(rect.y > 108 && rect.y < 188);
  assert.ok(rect.height >= 2);
});
