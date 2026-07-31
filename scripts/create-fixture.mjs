import { mkdir, writeFile } from "node:fs/promises";
import {
  MIDIBuilder,
  MIDIMessageTypes
} from "spessasynth_core";

const midi = new MIDIBuilder({
  format: 1,
  initialTempo: 108,
  name: "MIDI RealPlayer Demo"
});
midi.addEvent(0, 0, MIDIMessageTypes.timeSignature, [4, 2, 24, 8]);

const instruments = [
  ["Acoustic Grand Piano", 0, 60],
  ["Electric Bass", 33, 40],
  ["Violin", 40, 67],
  ["Viola", 41, 55],
  ["Cello", 42, 48],
  ["Flute", 73, 76],
  ["Clarinet", 71, 70],
  ["Trumpet", 56, 64],
  ["Drums", 0, 36],
  ["Percussion", 8, 72],
  ["Glockenspiel", 9, 79],
  ["Harp", 46, 52]
];

for (const [trackIndex, [name, program, basePitch]] of instruments.entries()) {
  const track = trackIndex + 1;
  const channel = trackIndex === 8 ? 9 : trackIndex % 16;
  midi.addTrack(name);
  midi.programChange(0, track, channel, program);
  for (let step = 0; step < 64; step++) {
    const scaleOffset = [0, 2, 4, 7, 9, 7, 4, 2][
      (step + trackIndex) % 8
    ];
    const onset = step * 240;
    const duration =
      trackIndex === 8 ? 90 : [180, 360, 720][(step + trackIndex) % 3];
    const velocity = Math.round(
      (0.35 + ((step * 11 + trackIndex * 7) % 60) / 100) * 127
    );
    const pitch = Math.min(108, basePitch + scaleOffset);
    midi.noteOn(onset, track, channel, pitch, velocity);
    midi.noteOff(onset + duration, track, channel, pitch);
  }
}

midi.flush(true);
const output = new URL("../work/preview/demo.mid", import.meta.url);
await mkdir(new URL("../work/preview", import.meta.url), { recursive: true });
await writeFile(output, new Uint8Array(midi.writeMIDI()));
