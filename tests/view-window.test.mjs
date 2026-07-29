import assert from "node:assert/strict";
import test from "node:test";

import {
  centerViewWindow,
  followPlaybackView,
  panViewWindow,
  resetViewWindowToStart,
  zoomViewWindow
} from "../webview/view-window.ts";

test("returning to the song start also returns a zoomed viewport", () => {
  assert.deepEqual(resetViewWindowToStart(72, 92, 100), {
    start: 0,
    end: 20
  });
});

test("returning to the song start preserves a fitted viewport", () => {
  assert.deepEqual(resetViewWindowToStart(0, 100, 100), {
    start: 0,
    end: 100
  });
});

test("scrubbing centers the current zoom window on the target time", () => {
  assert.deepEqual(centerViewWindow(50, 10, 30, 100), {
    start: 40,
    end: 60
  });
});

test("scrubbing near the song edges keeps the window in bounds", () => {
  assert.deepEqual(centerViewWindow(3, 20, 40, 100), {
    start: 0,
    end: 20
  });
  assert.deepEqual(centerViewWindow(98, 20, 40, 100), {
    start: 80,
    end: 100
  });
});

test("fit view remains fitted while the playhead moves", () => {
  assert.deepEqual(centerViewWindow(75, 0, 100, 100), {
    start: 0,
    end: 100
  });
});

test("playback begins following after the playhead reaches the right safe area", () => {
  const followed = followPlaybackView(16, 0, 20, 100);
  assert.ok(Math.abs(followed.start - 1.6) < 1e-9);
  assert.ok(Math.abs(followed.end - 21.6) < 1e-9);
  assert.deepEqual(followPlaybackView(10, 0, 20, 100), {
    start: 0,
    end: 20
  });
});

test("playback immediately reveals a playhead left of the zoomed viewport", () => {
  const followed = followPlaybackView(20, 60, 80, 100);
  assert.ok(Math.abs(followed.start - 14.4) < 1e-9);
  assert.ok(Math.abs(followed.end - 34.4) < 1e-9);
});

test("pointer-anchored zoom preserves the time beneath the pointer", () => {
  assert.deepEqual(zoomViewWindow(30, 0.25, 0.5, 20, 60, 100), {
    start: 25,
    end: 45
  });
});

test("horizontal panning preserves the zoom window and respects song edges", () => {
  assert.deepEqual(panViewWindow(12, 20, 40, 100), {
    start: 32,
    end: 52
  });
  assert.deepEqual(panViewWindow(90, 20, 40, 100), {
    start: 80,
    end: 100
  });
});
