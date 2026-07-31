import assert from "node:assert/strict";
import test from "node:test";
import {
  BasicMIDI,
  MIDIBuilder,
  MIDIMessageTypes
} from "spessasynth_core";
import { parseCanonicalMidi } from "../webview/canonical-midi.ts";
import { buildPlaybackMidi } from "../webview/playback-midi.ts";

function createOwnershipRegressionMidi() {
  const source = new MIDIBuilder({ format: 1, name: "" });

  source.addTrack("");
  source.controllerChange(0, 1, 5, 1, 80);

  source.addTrack("Synth Lead");
  source.programChange(0, 2, 0, 80);
  source.noteOn(0, 2, 0, 60, 64);
  source.noteOff(960, 2, 0, 60);

  source.addTrack("Synth Pad");
  source.programChange(0, 3, 0, 88);
  source.noteOn(480, 3, 0, 67, 100);
  source.noteOff(1440, 3, 0, 67);
  source.flush(true);
  return source.writeMIDI();
}

function playedNoteNumbers(binary) {
  const midi = BasicMIDI.fromArrayBuffer(binary);
  return midi.tracks
    .flatMap((track) => track.events)
    .filter(
      (event) =>
        (event.statusByte & 0xf0) === MIDIMessageTypes.noteOn &&
        (event.data[1] ?? 0) > 0
    )
    .map((event) => event.data[0])
    .sort((left, right) => left - right);
}

test("one BasicMIDI parse creates stable logical tracks including automation", () => {
  const document = parseCanonicalMidi(createOwnershipRegressionMidi());

  assert.equal(document.tracks.length, 3);
  assert.deepEqual(
    document.tracks.map((track) => ({
      name: track.name,
      sourceTrackIndex: track.sourceTrackIndex,
      sourceChannel: track.sourceChannel,
      notes: track.notes.map((note) => note.midi)
    })),
    [
      {
        name: "Untitled Track 1",
        sourceTrackIndex: 1,
        sourceChannel: 5,
        notes: []
      },
      {
        name: "Synth Lead",
        sourceTrackIndex: 2,
        sourceChannel: 0,
        notes: [60]
      },
      {
        name: "Synth Pad",
        sourceTrackIndex: 3,
        sourceChannel: 0,
        notes: [67]
      }
    ]
  );
  assert.equal(document.tracks[1]?.instrument, "Lead 1 (Square)");
  assert.equal(document.tracks[1]?.instrumentFamily, "synth lead");
  assert.equal(document.tracks[2]?.instrument, "Pad 1 (New Age)");
  assert.equal(document.tracks[2]?.instrumentFamily, "synth pad");
});

test("track ownership, not array position, decides which notes play", () => {
  const document = parseCanonicalMidi(createOwnershipRegressionMidi());
  const lead = document.tracks.find((track) => track.name === "Synth Lead");
  const pad = document.tracks.find((track) => track.name === "Synth Pad");
  assert.ok(lead);
  assert.ok(pad);

  assert.deepEqual(
    playedNoteNumbers(
      buildPlaybackMidi(document.original, document.tracks, new Set([lead.id]))
    ),
    [60]
  );
  assert.deepEqual(
    playedNoteNumbers(
      buildPlaybackMidi(document.original, document.tracks, new Set([pad.id]))
    ),
    [67]
  );
});

test("tracks sharing one source channel receive independent playback routes", () => {
  const document = parseCanonicalMidi(createOwnershipRegressionMidi());
  const lead = document.tracks.find((track) => track.name === "Synth Lead");
  const pad = document.tracks.find((track) => track.name === "Synth Pad");
  assert.ok(lead);
  assert.ok(pad);
  assert.equal(lead.sourceChannel, pad.sourceChannel);
  assert.notEqual(lead.playbackChannelIndex, pad.playbackChannelIndex);

  const playback = BasicMIDI.fromArrayBuffer(
    buildPlaybackMidi(
      document.original,
      document.tracks,
      new Set([lead.id, pad.id])
    )
  );
  const programs = playback.tracks
    .flatMap((track) =>
      track.events
        .filter(
          (event) =>
            (event.statusByte & 0xf0) === MIDIMessageTypes.programChange
        )
        .map((event) => ({
          channel:
            (playback.portChannelOffsetMap[track.port] ?? 0) +
            (event.statusByte & 0x0f),
          program: event.data[0]
        }))
    )
    .sort((left, right) => left.channel - right.channel);
  assert.deepEqual(programs, [
    { channel: lead.playbackChannelIndex, program: 80 },
    { channel: pad.playbackChannelIndex, program: 88 }
  ]);
});

test("twelve same-channel tracks remain independently selectable", () => {
  const source = new MIDIBuilder({ format: 1, name: "" });
  for (let index = 0; index < 12; index++) {
    const track = index + 1;
    source.addTrack(`Track ${index + 1}`);
    source.programChange(0, track, 0, index);
    source.noteOn(index * 120, track, 0, 48 + index, 90);
    source.noteOff(index * 120 + 100, track, 0, 48 + index);
  }
  source.flush(true);
  const document = parseCanonicalMidi(source.writeMIDI());
  assert.equal(document.tracks.length, 12);
  assert.equal(
    new Set(document.tracks.map((track) => track.playbackChannelIndex)).size,
    12
  );

  const enabled = new Set([
    document.tracks[2]?.id,
    document.tracks[7]?.id,
    document.tracks[11]?.id
  ].filter(Boolean));
  assert.deepEqual(
    playedNoteNumbers(
      buildPlaybackMidi(document.original, document.tracks, enabled)
    ),
    [50, 55, 59]
  );
});

test("more than sixteen tracks are routed through MIDI ports", () => {
  const source = new MIDIBuilder({ format: 1, name: "" });
  for (let index = 0; index < 20; index++) {
    const track = index + 1;
    source.addTrack(`Track ${index + 1}`);
    source.noteOn(index * 10, track, 0, 40 + index, 90);
    source.noteOff(index * 10 + 5, track, 0, 40 + index);
  }
  source.flush(true);
  const document = parseCanonicalMidi(source.writeMIDI());
  const playback = BasicMIDI.fromArrayBuffer(
    buildPlaybackMidi(
      document.original,
      document.tracks,
      new Set(document.tracks.map((track) => track.id))
    )
  );

  assert.deepEqual(playback.portChannelOffsetMap, [0, 16]);
  assert.equal(playback.isMultiPort, true);
  assert.equal(
    new Set(document.tracks.map((track) => track.playbackChannelIndex)).size,
    20
  );
});

test("all tracks off produces a silent playback MIDI", () => {
  const document = parseCanonicalMidi(createOwnershipRegressionMidi());
  assert.deepEqual(
    playedNoteNumbers(
      buildPlaybackMidi(document.original, document.tracks, new Set())
    ),
    []
  );
});

test("note duration and velocity come from the canonical BasicMIDI events", () => {
  const document = parseCanonicalMidi(createOwnershipRegressionMidi());
  const note = document.tracks.find(
    (track) => track.name === "Synth Lead"
  )?.notes[0];
  assert.ok(note);
  assert.equal(note.ticks, 0);
  assert.equal(note.velocity, 64 / 127);
  assert.ok(note.duration > 0);
});
