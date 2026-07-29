import {
  BasicMIDI,
  MIDIMessageTypes,
  type MIDIMessage
} from "spessasynth_core";

export type LogicalTrackSource = {
  trackIndex: number;
  channel?: number;
};

export function buildFilteredMidi(
  original: BasicMIDI,
  disabledTracks: readonly LogicalTrackSource[]
): ArrayBuffer {
  const filtered = BasicMIDI.copyFrom(original);
  for (const disabledTrack of disabledTracks) {
    const track = filtered.tracks[disabledTrack.trackIndex];
    if (!track) {
      continue;
    }
    for (let eventIndex = track.events.length - 1; eventIndex >= 0; eventIndex--) {
      const event = track.events[eventIndex] as MIDIMessage | undefined;
      if (
        event &&
        isChannelMessage(event.statusByte) &&
        (disabledTrack.channel === undefined ||
          (event.statusByte & 0x0f) === disabledTrack.channel)
      ) {
        track.deleteEvent(eventIndex);
      }
    }
  }
  filtered.flush(true);
  return filtered.writeMIDI();
}

export function findLogicalTrackSources(
  midi: BasicMIDI
): LogicalTrackSource[] {
  return midi.tracks.flatMap((track, trackIndex) => {
    const noteChannels = new Set<number>();
    for (const event of track.events) {
      if (
        (event.statusByte & 0xf0) === MIDIMessageTypes.noteOn &&
        (event.data[1] ?? 0) > 0
      ) {
        noteChannels.add(event.statusByte & 0x0f);
      }
    }
    if (noteChannels.size > 0) {
      return [...noteChannels].map((channel) => ({ trackIndex, channel }));
    }
    return track.name.trim() ? [{ trackIndex }] : [];
  });
}

export function isChannelMessage(statusByte: number): boolean {
  return (
    statusByte >= MIDIMessageTypes.noteOff &&
    statusByte < MIDIMessageTypes.systemExclusive
  );
}
