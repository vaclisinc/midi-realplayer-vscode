import assert from "node:assert/strict";
import test from "node:test";
import { getMidiPitchRange } from "../webview/pitch-range.ts";

test("piano roll range is derived from every MIDI track", () => {
  assert.deepEqual(
    getMidiPitchRange([
      { notes: [{ midi: 36 }, { midi: 40 }] },
      { notes: [{ midi: 72 }, { midi: 84 }] }
    ]),
    { min: 35, max: 85 }
  );
});

test("piano roll range stays stable when track UI state changes", () => {
  const tracks = [
    { notes: [{ midi: 36 }], enabled: true, solo: false },
    { notes: [{ midi: 84 }], enabled: true, solo: false }
  ];
  const before = getMidiPitchRange(tracks);
  tracks[1].enabled = false;
  tracks[0].solo = true;
  assert.deepEqual(getMidiPitchRange(tracks), before);
});

test("empty MIDI documents use the standard piano range", () => {
  assert.deepEqual(getMidiPitchRange([{ notes: [] }]), {
    min: 21,
    max: 108
  });
});
