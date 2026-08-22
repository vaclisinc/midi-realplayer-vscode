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
  return anyTrackSoloed ? track.solo && track.enabled : track.enabled;
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

export function haveSameTrackIds(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>
): boolean {
  return (
    left.size === right.size &&
    [...left].every((trackId) => right.has(trackId))
  );
}

export function toggleTrackMute(track: AudibilityTrack): void {
  const willMute = track.enabled;
  track.enabled = !willMute;
  if (willMute) {
    track.solo = false;
  }
}

export function toggleTrackSolo(track: AudibilityTrack): void {
  track.solo = !track.solo;
  if (track.solo) {
    track.enabled = true;
  }
}

/**
 * The live engine must always keep a timed MIDI sequence loaded. When every
 * track is muted, retain all tracks in the engine and silence their channel
 * gains instead of loading a note-less sequence that cannot advance reliably.
 */
export function getEngineTrackIds(
  tracks: readonly AudibilityTrack[]
): Set<string> {
  const audibleTrackIds = getAudibleTrackIds(tracks);
  return audibleTrackIds.size > 0
    ? audibleTrackIds
    : new Set(tracks.map((track) => track.id));
}
