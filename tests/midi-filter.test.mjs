import assert from "node:assert/strict";
import test from "node:test";
import midiPackage from "@tonejs/midi";
import { BasicMIDI, MIDIBuilder } from "spessasynth_core";
import {
  buildFilteredMidi,
  findLogicalTrackSources
} from "../webview/midi-filter.ts";

const { Midi } = midiPackage;

function createTwoTrackMidi() {
  const source = new Midi();
  source.header.setTempo(96);

  const piano = source.addTrack();
  piano.name = "Piano";
  piano.channel = 0;
  piano.instrument.number = 0;
  piano.addNote({ midi: 60, ticks: 0, durationTicks: 960, velocity: 0.4 });

  const violin = source.addTrack();
  violin.name = "Violin";
  violin.channel = 1;
  violin.instrument.number = 40;
  violin.addNote({ midi: 67, ticks: 480, durationTicks: 1920, velocity: 0.85 });

  return BasicMIDI.fromArrayBuffer(source.toArray().buffer);
}

test("playable UI tracks map past the leading conductor track", () => {
  const original = createTwoTrackMidi();
  assert.deepEqual(findLogicalTrackSources(original), [
    { trackIndex: 1, channel: 0 },
    { trackIndex: 2, channel: 1 }
  ]);
});

test("disabled tracks lose channel events while timing metadata survives", () => {
  const original = createTwoTrackMidi();
  const [pianoTrack] = findLogicalTrackSources(original);
  assert.notEqual(pianoTrack, undefined);
  const reparsed = BasicMIDI.fromArrayBuffer(
    buildFilteredMidi(original, [pianoTrack])
  );
  const noteTimes = reparsed.getNoteTimes();
  assert.equal(noteTimes[0]?.length, 0);
  assert.equal(noteTimes[1]?.length, 1);
  assert.equal(noteTimes[1]?.[0]?.velocity, Math.floor(0.85 * 127));
  assert.ok((noteTimes[1]?.[0]?.length ?? 0) > 2);
  assert.ok(
    reparsed.tempoChanges.some((change) => Math.round(change.tempo) === 96)
  );
});

test("the final visible track can be disabled independently", () => {
  const original = createTwoTrackMidi();
  const [, violinTrack] = findLogicalTrackSources(original);
  assert.notEqual(violinTrack, undefined);
  const reparsed = BasicMIDI.fromArrayBuffer(
    buildFilteredMidi(original, [violinTrack])
  );
  const noteTimes = reparsed.getNoteTimes();
  assert.equal(noteTimes[0]?.length, 1);
  assert.equal(noteTimes[1]?.length, 0);
});

test("disabling every source track leaves no playable notes", () => {
  const original = createTwoTrackMidi();
  const allTracks = original.tracks.map((_, trackIndex) => ({ trackIndex }));
  const reparsed = BasicMIDI.fromArrayBuffer(
    buildFilteredMidi(original, allTracks)
  );
  assert.equal(
    reparsed.getNoteTimes().flat().length,
    0,
    "all-off playback must be silent"
  );
});

test("one physical track can expose multiple channel tracks plus an empty track", () => {
  const source = new MIDIBuilder({ format: 1, name: "" });
  source.addTrack("bass");
  source.programChange(0, 1, 0, 33);
  source.noteOn(0, 1, 0, 40, 80);
  source.noteOff(480, 1, 0, 40);
  source.programChange(0, 1, 1, 32);
  source.noteOn(0, 1, 1, 43, 90);
  source.noteOff(480, 1, 1, 43);

  source.addTrack("drums");
  source.noteOn(0, 2, 9, 36, 100);
  source.noteOff(120, 2, 9, 36);

  source.addTrack("guitar");

  source.addTrack("piano");
  source.noteOn(0, 4, 2, 60, 80);
  source.noteOff(480, 4, 2, 60);
  source.noteOn(0, 4, 3, 67, 80);
  source.noteOff(480, 4, 3, 67);
  source.flush(true);

  assert.deepEqual(findLogicalTrackSources(source), [
    { trackIndex: 1, channel: 0 },
    { trackIndex: 1, channel: 1 },
    { trackIndex: 2, channel: 9 },
    { trackIndex: 3 },
    { trackIndex: 4, channel: 2 },
    { trackIndex: 4, channel: 3 }
  ]);

  const tone = new Midi(source.writeMIDI());
  assert.equal(tone.tracks.length, 6);
  assert.equal(tone.tracks[3]?.name, "guitar");
  assert.equal(tone.tracks[3]?.notes.length, 0);

  const withoutAcousticBass = BasicMIDI.fromArrayBuffer(
    buildFilteredMidi(source, [{ trackIndex: 1, channel: 1 }])
  );
  assert.equal(withoutAcousticBass.getNoteTimes()[0]?.length, 1);
  assert.equal(withoutAcousticBass.getNoteTimes()[1]?.length, 0);
  assert.equal(withoutAcousticBass.getNoteTimes()[9]?.length, 1);
});
