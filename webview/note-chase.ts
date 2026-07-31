export type ChaseableNote = {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
};

export type ChaseableTrack = {
  enabled: boolean;
  playbackChannelIndex?: number;
  notes: ChaseableNote[];
};

export type ChasedNote = {
  channel: number;
  midi: number;
  velocity: number;
};

const NOTE_TIME_EPSILON_SECONDS = 0.000001;

export function getActiveNotesAtTime(
  tracks: ChaseableTrack[],
  time: number
): ChasedNote[] {
  return tracks.flatMap((track) => {
    if (!track.enabled || track.playbackChannelIndex === undefined) {
      return [];
    }

    return track.notes
      .filter(
        (note) =>
          note.time < time - NOTE_TIME_EPSILON_SECONDS &&
          note.time + Math.max(note.duration, 0.004) >
            time + NOTE_TIME_EPSILON_SECONDS
      )
      .map((note) => ({
        channel: track.playbackChannelIndex!,
        midi: note.midi,
        velocity: Math.max(1, Math.min(127, Math.round(note.velocity * 127)))
      }));
  });
}
