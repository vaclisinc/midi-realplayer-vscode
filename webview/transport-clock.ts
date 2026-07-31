export type TransportSequencer = {
  paused: boolean;
  currentTime: number;
  play(): void;
};

/**
 * SpessaSynth advances a paused seek to the next MIDI event while reconstructing
 * channel state. Enter playing state first so the requested wall-clock position
 * remains exact, including silent gaps between events.
 */
export function resumeTransport(
  sequencer: TransportSequencer,
  targetTime: number,
  seekPending: boolean
): void {
  sequencer.play();
  if (seekPending) {
    sequencer.currentTime = targetTime;
  }
}

/**
 * Apply seeks immediately while playing. While paused, defer the seek until
 * resume so SpessaSynth cannot replace the requested time with the next event.
 */
export function seekTransport(
  sequencer: TransportSequencer,
  targetTime: number
): boolean {
  if (sequencer.paused) {
    return true;
  }
  sequencer.currentTime = targetTime;
  return false;
}
