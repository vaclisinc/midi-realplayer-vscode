import assert from "node:assert/strict";
import test from "node:test";
import {
  collectViewerTrackState,
  normalizeViewerState
} from "../webview/viewer-state.ts";

test("viewer state restores stable per-track mixer controls", () => {
  const state = normalizeViewerState({
    followPlayhead: false,
    viewMode: "arrangement",
    arrangementTrackHeight: 120,
    pianoRollRowHeight: 14,
    tracks: {
      lead: { enabled: false, gain: 0.35 }
    }
  });

  assert.equal(state.followPlayhead, false);
  assert.equal(state.viewMode, "arrangement");
  assert.equal(state.arrangementTrackHeight, 120);
  assert.equal(state.pianoRollRowHeight, 14);
  assert.deepEqual(state.tracks?.lead, { enabled: false, gain: 0.35 });
});

test("viewer state migrates the previous gains-only format", () => {
  const state = normalizeViewerState({
    trackGains: { bass: 0.4 },
    trackEnabled: { bass: false }
  });

  assert.deepEqual(state.tracks?.bass, { enabled: false, gain: 0.4 });
});

test("viewer state serializes enabled and gain together", () => {
  assert.deepEqual(
    collectViewerTrackState([
      { id: "pad", enabled: true, gain: 0.8 },
      { id: "lead", enabled: false, gain: 0.2 }
    ]),
    {
      pad: { enabled: true, gain: 0.8 },
      lead: { enabled: false, gain: 0.2 }
    }
  );
});
