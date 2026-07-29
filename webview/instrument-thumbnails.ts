const familyIndexes: Record<string, number> = {
  piano: 0,
  "chromatic percussion": 1,
  organ: 2,
  guitar: 3,
  bass: 4,
  strings: 5,
  ensemble: 6,
  brass: 7,
  reed: 8,
  pipe: 9,
  "synth lead": 10,
  "synth pad": 11,
  "synth effects": 12,
  world: 13,
  ethnic: 13,
  percussive: 14,
  percussion: 14,
  "sound effects": 15
};

export function getInstrumentThumbnailIndex(
  family: string,
  isDrums: boolean
): number {
  return isDrums ? 14 : familyIndexes[family.toLowerCase()] ?? 12;
}
