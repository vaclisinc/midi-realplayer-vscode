export type TrackPresetSelection = {
  bankMSB: number;
  bankLSB: number;
  program: number;
  isGMGSDrum: boolean;
  name: string;
};

export type SoundFontPreset = TrackPresetSelection & {
  isDrum?: boolean;
};

export const CHOIR_AAHS_PROGRAM = 52;

export function getDefaultTrackPreset(track: {
  program?: number;
  isDrums: boolean;
}): TrackPresetSelection | null {
  if (track.isDrums || track.program !== CHOIR_AAHS_PROGRAM) {
    return null;
  }
  return {
    bankMSB: 0,
    bankLSB: 0,
    program: CHOIR_AAHS_PROGRAM,
    isGMGSDrum: false,
    name: "Concert Choir"
  };
}

export function presetKey(
  preset: Pick<
    TrackPresetSelection,
    "bankMSB" | "bankLSB" | "program" | "isGMGSDrum"
  >
): string {
  return [
    clampMidiByte(preset.bankMSB),
    clampMidiByte(preset.bankLSB),
    clampMidiByte(preset.program),
    preset.isGMGSDrum ? 1 : 0
  ].join(":");
}

export function findPresetByKey<T extends SoundFontPreset>(
  presets: readonly T[],
  key: string
): T | undefined {
  return presets.find((preset) => presetKey(preset) === key);
}

export function normalizeTrackPreset(
  value: unknown
): TrackPresetSelection | null | undefined {
  if (value === null) {
    return null;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.bankMSB !== "number" ||
    typeof candidate.bankLSB !== "number" ||
    typeof candidate.program !== "number"
  ) {
    return undefined;
  }
  return {
    bankMSB: clampMidiByte(candidate.bankMSB),
    bankLSB: clampMidiByte(candidate.bankLSB),
    program: clampMidiByte(candidate.program),
    isGMGSDrum: candidate.isGMGSDrum === true,
    name:
      typeof candidate.name === "string" && candidate.name.trim()
        ? candidate.name.trim()
        : `Program ${clampMidiByte(candidate.program) + 1}`
  };
}

function clampMidiByte(value: number): number {
  return Math.min(127, Math.max(0, Math.trunc(value)));
}
