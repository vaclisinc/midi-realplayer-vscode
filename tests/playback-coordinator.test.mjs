import assert from "node:assert/strict";
import test from "node:test";
import { PlaybackCoordinator } from "../webview/playback-coordinator.ts";

test("a rebuild preserves the live engine time instead of an old pending seek", () => {
  const playback = new PlaybackCoordinator();
  playback.seek(8, 8, 60);
  playback.requestPlay();
  playback.markEngineResumed();

  playback.beginRebuild(12.5, 60);
  assert.equal(playback.currentTime, 12.5);
  assert.equal(playback.pendingEngineTime, 12.5);
  assert.equal(playback.completeRebuild(), true);
  assert.equal(playback.pendingEngineTime, 12.5);
});

test("play and pause requests made during mute or solo rebuild win on completion", () => {
  const playback = new PlaybackCoordinator();
  playback.seek(18, 18, 60);
  playback.requestPlay();
  playback.beginRebuild(21.25, 60);

  playback.requestPause(undefined, 60);
  playback.requestPlay();

  assert.equal(playback.completeRebuild(), true);
  assert.equal(playback.pendingEngineTime, 21.25);
  assert.equal(playback.engineSeekPending, true);
});

test("overlapping rebuild requests resume only after the final rebuild", () => {
  const playback = new PlaybackCoordinator();
  playback.seek(4, 4, 60);
  playback.requestPlay();

  assert.equal(playback.beginRebuild(5.5, 60), true);
  assert.equal(playback.beginRebuild(undefined, 60), false);
  assert.equal(playback.completeRebuild(), false);
  assert.equal(playback.completeRebuild(), true);
  assert.equal(playback.pendingEngineTime, 5.5);
});

test("pausing during a rebuild prevents automatic resume", () => {
  const playback = new PlaybackCoordinator();
  playback.requestPlay();
  playback.beginRebuild(7.75, 60);
  playback.requestPause(undefined, 60);

  assert.equal(playback.completeRebuild(), false);
  assert.equal(playback.currentTime, 7.75);
  assert.equal(playback.pendingEngineTime, 7.75);
});
