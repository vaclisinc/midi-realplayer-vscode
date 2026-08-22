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
      lead: { enabled: false, solo: true, gain: 0.35 }
    }
  });

  assert.equal(state.followPlayhead, false);
  assert.equal(state.viewMode, "arrangement");
  assert.equal(state.arrangementTrackHeight, 120);
  assert.equal(state.pianoRollRowHeight, 14);
  assert.deepEqual(state.tracks?.lead, {
    enabled: false,
    solo: true,
    gain: 0.35
  });
});

test("viewer state migrates the previous gains-only format", () => {
  const state = normalizeViewerState({
    trackGains: { bass: 0.4 },
    trackEnabled: { bass: false }
  });

  assert.deepEqual(state.tracks?.bass, {
    enabled: false,
    solo: false,
    gain: 0.4
  });
  assert.equal(state.viewMode, undefined);
});

test("viewer state serializes mute, solo, and gain together", () => {
  const voicePreset = {
    bankMSB: 0,
    bankLSB: 0,
    program: 53,
    isGMGSDrum: false,
    name: "Voice Oohs"
  };
  assert.deepEqual(
    collectViewerTrackState([
      {
        id: "pad",
        enabled: true,
        solo: true,
        gain: 0.8,
        presetOverride: voicePreset
      },
      {
        id: "lead",
        enabled: false,
        solo: false,
        gain: 0.2,
        presetOverride: null
      }
    ]),
    {
      pad: {
        enabled: true,
        solo: true,
        gain: 0.8,
        presetOverride: voicePreset
      },
      lead: {
        enabled: false,
        solo: false,
        gain: 0.2,
        presetOverride: null
      }
    }
  );
});

test("viewer state restores a per-track preset override", () => {
  const state = normalizeViewerState({
    tracks: {
      vocal: {
        enabled: true,
        solo: false,
        gain: 1,
        presetOverride: {
          bankMSB: 0,
          bankLSB: 0,
          program: 53,
          isGMGSDrum: false,
          name: "Voice Oohs"
        }
      }
    }
  });
  assert.equal(state.tracks?.vocal.presetOverride?.program, 53);
});

test("viewer state preserves boosted track gain up to 200 percent", () => {
  const state = normalizeViewerState({
    tracks: {
      lead: { enabled: true, solo: false, gain: 1.5 },
      pad: { enabled: true, solo: false, gain: 3 }
    }
  });

  assert.equal(state.tracks?.lead.gain, 1.5);
  assert.equal(state.tracks?.pad.gain, 2);
});
