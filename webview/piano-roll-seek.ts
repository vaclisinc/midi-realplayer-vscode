export type SeekableNote = {
  midi: number;
  time: number;
  duration: number;
};

export type SeekableTrack = {
  enabled: boolean;
  notes: SeekableNote[];
};

export type PianoRollSeek = {
  displayTime: number;
  engineTime: number;
  snappedToNote: boolean;
};

const NOTE_PREROLL_SECONDS = 0.004;

export function resolvePianoRollSeek(
  tracks: SeekableTrack[],
  clickedTime: number,
  clickedMidi?: number
): PianoRollSeek {
  if (clickedMidi === undefined) {
    return {
      displayTime: clickedTime,
      engineTime: clickedTime,
      snappedToNote: false
    };
  }

  const clickedNote = tracks
    .filter((track) => track.enabled)
    .flatMap((track) => track.notes)
    .filter(
      (note) =>
        note.midi === clickedMidi &&
        clickedTime >= note.time &&
        clickedTime < note.time + Math.max(note.duration, 0.004)
    )
    .sort((left, right) => right.time - left.time)[0];

  if (!clickedNote) {
    return {
      displayTime: clickedTime,
      engineTime: clickedTime,
      snappedToNote: false
    };
  }

  return {
    displayTime: clickedNote.time,
    engineTime: Math.max(0, clickedNote.time - NOTE_PREROLL_SECONDS),
    snappedToNote: true
  };
}
