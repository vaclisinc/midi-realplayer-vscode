import { mkdir, writeFile } from "node:fs/promises";
import midiPackage from "@tonejs/midi";

const { Midi } = midiPackage;
const midi = new Midi();
midi.header.setTempo(108);
midi.header.timeSignatures.push({
  ticks: 0,
  timeSignature: [4, 4],
  measures: 0
});
midi.header.update();

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
  const track = midi.addTrack();
  track.name = name;
  track.channel = trackIndex === 8 ? 9 : trackIndex % 16;
  track.instrument.number = program;
  for (let step = 0; step < 64; step++) {
    const scaleOffset = [0, 2, 4, 7, 9, 7, 4, 2][
      (step + trackIndex) % 8
    ];
    track.addNote({
      midi: Math.min(108, basePitch + scaleOffset),
      ticks: step * 240,
      durationTicks:
        trackIndex === 8 ? 90 : [180, 360, 720][(step + trackIndex) % 3],
      velocity: 0.35 + ((step * 11 + trackIndex * 7) % 60) / 100
    });
  }
}

const output = new URL("../work/preview/demo.mid", import.meta.url);
await mkdir(new URL("../work/preview", import.meta.url), { recursive: true });
await writeFile(output, midi.toArray());
