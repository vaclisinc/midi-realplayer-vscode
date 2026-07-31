import {
  BasicMIDI,
  MIDIMessage,
  MIDIMessageTypes,
  MIDITrack
} from "spessasynth_core";
import {
  isChannelMessage,
  type CanonicalTrack,
  type TrackId
} from "./canonical-midi.ts";

export function buildPlaybackMidi(
  original: BasicMIDI,
  tracks: readonly CanonicalTrack[],
  enabledTrackIds: ReadonlySet<TrackId>
): ArrayBuffer {
  const playback = BasicMIDI.copyFrom(original);
  const outputTracks: MIDITrack[] = [];
  const tracksBySource = new Map<number, CanonicalTrack[]>();
  for (const track of tracks) {
    const group = tracksBySource.get(track.sourceTrackIndex) ?? [];
    group.push(track);
    tracksBySource.set(track.sourceTrackIndex, group);
  }

  original.tracks.forEach((source, sourceTrackIndex) => {
    const logicalTracks = tracksBySource.get(sourceTrackIndex) ?? [];
    const channelTracks = logicalTracks.filter(
      (track) => track.sourceChannel !== undefined
    );

    if (channelTracks.length === 0) {
      outputTracks.push(MIDITrack.copyFrom(source));
      return;
    }

    const metadataTrack = copyEvents(
      source,
      (event) => !isChannelMessage(event.statusByte)
    );
    if (metadataTrack.events.length > 0) {
      outputTracks.push(metadataTrack);
    }

    for (const logicalTrack of channelTracks) {
      if (
        !enabledTrackIds.has(logicalTrack.id) ||
        logicalTrack.sourceChannel === undefined ||
        logicalTrack.playbackChannel === undefined ||
        logicalTrack.playbackPort === undefined
      ) {
        continue;
      }
      const routed = new MIDITrack();
      routed.name = source.name;
      routed.port = logicalTrack.playbackPort;
      routed.pushEvent(
        new MIDIMessage(
          0,
          MIDIMessageTypes.midiPort,
          new Uint8Array([logicalTrack.playbackPort])
        )
      );
      for (const event of source.events) {
        if (
          !isChannelMessage(event.statusByte) ||
          (event.statusByte & 0x0f) !== logicalTrack.sourceChannel
        ) {
          continue;
        }
        routed.pushEvent(
          new MIDIMessage(
            event.ticks,
            ((event.statusByte & 0xf0) |
              logicalTrack.playbackChannel) as MIDIMessage["statusByte"],
            new Uint8Array(event.data)
          )
        );
      }
      outputTracks.push(routed);
    }
  });

  playback.tracks = outputTracks;
  playback.format = outputTracks.length > 1 ? 1 : 0;
  playback.flush(true);
  return playback.writeMIDI();
}

function copyEvents(
  source: MIDITrack,
  predicate: (event: MIDIMessage) => boolean
): MIDITrack {
  const output = new MIDITrack();
  output.name = source.name;
  output.port = source.port;
  for (const event of source.events) {
    if (predicate(event)) {
      output.pushEvent(
        new MIDIMessage(
          event.ticks,
          event.statusByte,
          new Uint8Array(event.data)
        )
      );
    }
  }
  return output;
}
