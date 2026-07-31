export type MixableTrack = {
  id: string;
  gain: number;
};

export function updateTrackGain(
  tracks: MixableTrack[],
  trackId: string,
  gain: number
): boolean {
  const track = tracks.find((candidate) => candidate.id === trackId);
  if (!track) {
    return false;
  }

  track.gain = Math.min(1, Math.max(0, gain));
  return true;
}

export function collectTrackGains(
  tracks: readonly MixableTrack[]
): Record<string, number> {
  const gains: Record<string, number> = {};
  for (const track of tracks) {
    gains[track.id] = track.gain;
  }
  return gains;
}
