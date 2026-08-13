export type AudibilityTrack = {
  id: string;
  enabled: boolean;
  solo: boolean;
};

export function hasSoloedTracks(
  tracks: readonly Pick<AudibilityTrack, "solo">[]
): boolean {
  return tracks.some((track) => track.solo);
}

export function isTrackAudible(
  track: Pick<AudibilityTrack, "enabled" | "solo">,
  anyTrackSoloed: boolean
): boolean {
  return anyTrackSoloed ? track.solo : track.enabled;
}

export function getAudibleTrackIds(
  tracks: readonly AudibilityTrack[]
): Set<string> {
  const anyTrackSoloed = hasSoloedTracks(tracks);
  return new Set(
    tracks
      .filter((track) => isTrackAudible(track, anyTrackSoloed))
      .map((track) => track.id)
  );
}
