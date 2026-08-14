export type PitchRangeTrack = {
  notes: readonly { midi: number }[];
};

export type PitchRange = {
  min: number;
  max: number;
};

const DEFAULT_PITCH_RANGE: PitchRange = { min: 21, max: 108 };

export function getMidiPitchRange(
  tracks: readonly PitchRangeTrack[]
): PitchRange {
  let lowest = 128;
  let highest = -1;
  for (const track of tracks) {
    for (const note of track.notes) {
      const pitch = clampMidiPitch(note.midi);
      lowest = Math.min(lowest, pitch);
      highest = Math.max(highest, pitch);
    }
  }
  if (highest < lowest) {
    return { ...DEFAULT_PITCH_RANGE };
  }
  return {
    min: Math.max(0, lowest - 1),
    max: Math.min(127, highest + 1)
  };
}

function clampMidiPitch(value: number): number {
  return Math.min(127, Math.max(0, Math.trunc(value)));
}
