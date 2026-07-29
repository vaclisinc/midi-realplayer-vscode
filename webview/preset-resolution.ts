import {
  MIDIPatchTools,
  type MIDIPatch,
  type MIDIPatchFull,
  type MIDISystem
} from "spessasynth_core";

export type PresetResolution = {
  name: string;
  fallback: boolean;
};

export function resolvePreset(
  presets: MIDIPatchFull[],
  requested: MIDIPatch,
  system: MIDISystem
): PresetResolution | undefined {
  if (presets.length === 0) {
    return undefined;
  }
  const resolved = MIDIPatchTools.selectPatch(presets, requested, system);
  return {
    name: resolved.name,
    fallback: !MIDIPatchTools.matches(resolved, requested)
  };
}
