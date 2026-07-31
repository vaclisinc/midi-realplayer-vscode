import assert from "node:assert/strict";
import test from "node:test";
import {
  resumeTransport,
  seekTransport
} from "../webview/transport-clock.ts";

function createSequencer(paused = true) {
  const calls = [];
  let time = 4.25;
  return {
    calls,
    sequencer: {
      paused,
      get currentTime() {
        return time;
      },
      set currentTime(value) {
        calls.push(["seek", value]);
        time = value;
      },
      play() {
        calls.push(["play"]);
        this.paused = false;
      }
    }
  };
}

test("plain pause/resume does not perform a redundant seek", () => {
  const { calls, sequencer } = createSequencer();
  resumeTransport(sequencer, 4.25, false);
  assert.deepEqual(calls, [["play"]]);
});

test("a pending seek is applied only after leaving paused state", () => {
  const { calls, sequencer } = createSequencer();
  resumeTransport(sequencer, 5.5, true);
  assert.deepEqual(calls, [["play"], ["seek", 5.5]]);
});

test("seeking while paused is deferred but a playing seek is immediate", () => {
  const paused = createSequencer(true);
  assert.equal(seekTransport(paused.sequencer, 7), true);
  assert.deepEqual(paused.calls, []);

  const playing = createSequencer(false);
  assert.equal(seekTransport(playing.sequencer, 7), false);
  assert.deepEqual(playing.calls, [["seek", 7]]);
});
