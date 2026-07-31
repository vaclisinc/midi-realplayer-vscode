import {
  BasicMIDI,
  MIDIMessageTypes,
  type MIDIMessage
} from "spessasynth_core";
import {
  getGMProgramFamily,
  getGMProgramName
} from "./gm-programs.ts";

export type TrackId = string;

export type CanonicalNote = {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
  ticks: number;
};

export type TimeSignatureChange = {
  ticks: number;
  numerator: number;
  denominator: number;
};

export type CanonicalTrack = {
  id: TrackId;
  sourceTrackIndex: number;
  sourcePort: number;
  sourceChannel?: number;
  playbackPort?: number;
  playbackChannel?: number;
  playbackChannelIndex?: number;
  name: string;
  instrument: string;
  instrumentFamily: string;
  isDrums: boolean;
  notes: CanonicalNote[];
};

export type CanonicalMidiDocument = {
  original: BasicMIDI;
  duration: number;
  ppq: number;
  timeSignatures: TimeSignatureChange[];
  tracks: CanonicalTrack[];
};

type PendingNote = {
  ticks: number;
  velocity: number;
};

export function parseCanonicalMidi(
  binary: ArrayBuffer,
  fileName?: string
): CanonicalMidiDocument {
  const original = BasicMIDI.fromArrayBuffer(binary, fileName);
  const tracks: CanonicalTrack[] = [];

  original.tracks.forEach((sourceTrack, sourceTrackIndex) => {
    const channels = collectChannels(sourceTrack.events);
    if (channels.length === 0) {
      if (sourceTrack.name.trim()) {
        tracks.push({
          id: createTrackId(sourceTrackIndex, sourceTrack.port),
          sourceTrackIndex,
          sourcePort: sourceTrack.port,
          name: sourceTrack.name.trim(),
          instrument: "No note events",
          instrumentFamily: "music",
          isDrums: false,
          notes: []
        });
      }
      return;
    }

    for (const sourceChannel of channels) {
      const notes = pairNotes(original, sourceTrack.events, sourceChannel);
      const program = getProgramAtFirstNote(
        sourceTrack.events,
        sourceChannel,
        notes[0]?.ticks ?? Number.POSITIVE_INFINITY
      );
      const isDrums = sourceChannel === 9;
      tracks.push({
        id: createTrackId(
          sourceTrackIndex,
          sourceTrack.port,
          sourceChannel
        ),
        sourceTrackIndex,
        sourcePort: sourceTrack.port,
        sourceChannel,
        name: sourceTrack.name.trim() || `Untitled Track ${tracks.length + 1}`,
        instrument: getGMProgramName(program, isDrums),
        instrumentFamily: getGMProgramFamily(program, isDrums),
        isDrums,
        notes
      });
    }
  });

  assignPlaybackRoutes(tracks);

  return {
    original,
    duration: Math.max(original.duration, 0),
    ppq: original.timeDivision,
    timeSignatures: collectTimeSignatures(original),
    tracks
  };
}

export function createTrackId(
  trackIndex: number,
  port: number,
  channel?: number
): TrackId {
  return channel === undefined
    ? `track:${trackIndex}:port:${port}:meta`
    : `track:${trackIndex}:port:${port}:channel:${channel}`;
}

function collectChannels(events: readonly MIDIMessage[]): number[] {
  const channels = new Set<number>();
  for (const event of events) {
    if (isChannelMessage(event.statusByte)) {
      channels.add(event.statusByte & 0x0f);
    }
  }
  return [...channels].sort((left, right) => left - right);
}

function pairNotes(
  midi: BasicMIDI,
  events: readonly MIDIMessage[],
  channel: number
): CanonicalNote[] {
  const pending = new Map<number, PendingNote[]>();
  const notes: CanonicalNote[] = [];

  for (const event of events) {
    if (!isChannelMessage(event.statusByte)) {
      continue;
    }
    const eventChannel = event.statusByte & 0x0f;
    if (eventChannel !== channel) {
      continue;
    }
    const type = event.statusByte & 0xf0;
    const midiNote = event.data[0];
    if (midiNote === undefined) {
      continue;
    }
    const velocity = event.data[1] ?? 0;
    if (type === MIDIMessageTypes.noteOn && velocity > 0) {
      const queue = pending.get(midiNote) ?? [];
      queue.push({ ticks: event.ticks, velocity });
      pending.set(midiNote, queue);
      continue;
    }
    if (
      type !== MIDIMessageTypes.noteOff &&
      !(type === MIDIMessageTypes.noteOn && velocity === 0)
    ) {
      continue;
    }
    const queue = pending.get(midiNote);
    const onset = queue?.shift();
    if (!onset) {
      continue;
    }
    const start = midi.midiTicksToSeconds(onset.ticks);
    const end = midi.midiTicksToSeconds(Math.max(onset.ticks, event.ticks));
    notes.push({
      midi: midiNote,
      time: start,
      duration: Math.max(0, end - start),
      velocity: onset.velocity / 127,
      ticks: onset.ticks
    });
  }

  return notes.sort(
    (left, right) => left.ticks - right.ticks || left.midi - right.midi
  );
}

function getProgramAtFirstNote(
  events: readonly MIDIMessage[],
  channel: number,
  firstNoteTick: number
): number {
  let program = 0;
  for (const event of events) {
    if (event.ticks > firstNoteTick) {
      break;
    }
    if (
      (event.statusByte & 0xf0) === MIDIMessageTypes.programChange &&
      (event.statusByte & 0x0f) === channel
    ) {
      program = event.data[0] ?? program;
    }
  }
  return program;
}

function collectTimeSignatures(
  midi: BasicMIDI
): TimeSignatureChange[] {
  const changes: TimeSignatureChange[] = [];
  for (const track of midi.tracks) {
    for (const event of track.events) {
      if (event.statusByte !== MIDIMessageTypes.timeSignature) {
        continue;
      }
      changes.push({
        ticks: event.ticks,
        numerator: Math.max(1, event.data[0] ?? 4),
        denominator: 2 ** Math.min(7, event.data[1] ?? 2)
      });
    }
  }
  changes.sort((left, right) => left.ticks - right.ticks);
  if (changes[0]?.ticks !== 0) {
    changes.unshift({ ticks: 0, numerator: 4, denominator: 4 });
  }
  return deduplicateTickChanges(changes);
}

function deduplicateTickChanges(
  changes: TimeSignatureChange[]
): TimeSignatureChange[] {
  const result: TimeSignatureChange[] = [];
  for (const change of changes) {
    if (result.at(-1)?.ticks === change.ticks) {
      result[result.length - 1] = change;
    } else {
      result.push(change);
    }
  }
  return result;
}

function assignPlaybackRoutes(tracks: CanonicalTrack[]): void {
  const usedByPort = new Map<number, Set<number>>();
  for (const track of tracks) {
    if (track.sourceChannel === undefined) {
      continue;
    }
    const route = allocateRoute(usedByPort, track.isDrums);
    track.playbackPort = route.port;
    track.playbackChannel = route.channel;
    track.playbackChannelIndex = route.port * 16 + route.channel;
  }
}

function allocateRoute(
  usedByPort: Map<number, Set<number>>,
  isDrums: boolean
): { port: number; channel: number } {
  for (let port = 0; ; port++) {
    const used = usedByPort.get(port) ?? new Set<number>();
    const candidates = isDrums
      ? [9]
      : Array.from({ length: 16 }, (_, channel) => channel).filter(
          (channel) => channel !== 9
        );
    const channel = candidates.find((candidate) => !used.has(candidate));
    if (channel === undefined) {
      continue;
    }
    used.add(channel);
    usedByPort.set(port, used);
    return { port, channel };
  }
}

export function isChannelMessage(statusByte: number): boolean {
  return (
    statusByte >= MIDIMessageTypes.noteOff &&
    statusByte < MIDIMessageTypes.systemExclusive
  );
}
