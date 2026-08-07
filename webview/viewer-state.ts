export type ViewerMode = "piano-roll" | "arrangement";

export type PersistedTrackState = {
  enabled: boolean;
  gain: number;
};

export type PersistedViewerState = {
  followPlayhead: boolean;
  viewMode: ViewerMode;
  arrangementTrackHeight: number;
  pianoRollRowHeight: number;
  tracks: Record<string, PersistedTrackState>;
};

export const DEFAULT_ARRANGEMENT_TRACK_HEIGHT = 88;
export const DEFAULT_PIANO_ROLL_ROW_HEIGHT = 8;

export function normalizeViewerState(
  value: unknown
): Partial<PersistedViewerState> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const candidate = value as Record<string, unknown>;
  const legacyGains = isRecord(candidate.trackGains)
    ? candidate.trackGains
    : {};
  const legacyEnabled = isRecord(candidate.trackEnabled)
    ? candidate.trackEnabled
    : {};
  const tracks: Record<string, PersistedTrackState> = {};

  if (isRecord(candidate.tracks)) {
    for (const [trackId, raw] of Object.entries(candidate.tracks)) {
      if (!isRecord(raw)) {
        continue;
      }
      tracks[trackId] = {
        enabled: raw.enabled !== false,
        gain: clampNumber(raw.gain, 0, 1, 1)
      };
    }
  }
  for (const trackId of new Set([
    ...Object.keys(legacyGains),
    ...Object.keys(legacyEnabled)
  ])) {
    tracks[trackId] = {
      enabled: legacyEnabled[trackId] !== false,
      gain: clampNumber(legacyGains[trackId], 0, 1, 1)
    };
  }

  return {
    followPlayhead:
      typeof candidate.followPlayhead === "boolean"
        ? candidate.followPlayhead
        : undefined,
    viewMode:
      candidate.viewMode === "arrangement" ? "arrangement" : "piano-roll",
    arrangementTrackHeight: clampNumber(
      candidate.arrangementTrackHeight,
      52,
      180,
      DEFAULT_ARRANGEMENT_TRACK_HEIGHT
    ),
    pianoRollRowHeight: clampNumber(
      candidate.pianoRollRowHeight,
      6,
      24,
      DEFAULT_PIANO_ROLL_ROW_HEIGHT
    ),
    tracks
  };
}

export function collectViewerTrackState(
  tracks: readonly { id: string; enabled: boolean; gain: number }[]
): Record<string, PersistedTrackState> {
  return Object.fromEntries(
    tracks.map((track) => [
      track.id,
      {
        enabled: track.enabled,
        gain: clampNumber(track.gain, 0, 1, 1)
      }
    ])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
