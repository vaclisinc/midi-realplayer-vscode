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

const familyClassNames: Record<string, string> = {
  piano: "piano",
  "chromatic percussion": "chromatic-percussion",
  organ: "organ",
  guitar: "guitar",
  bass: "bass",
  strings: "strings",
  ensemble: "ensemble",
  brass: "brass",
  reed: "reed",
  pipe: "pipe",
  "synth lead": "synth-lead",
  "synth pad": "synth-pad",
  "synth effects": "synth-effects",
  world: "world",
  ethnic: "world",
  percussive: "percussion",
  percussion: "percussion",
  "sound effects": "sound-effects"
};

type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

const familyColors: Record<string, RgbColor> = {
  piano: { red: 78, green: 135, blue: 212 },
  "chromatic percussion": { red: 211, green: 164, blue: 59 },
  organ: { red: 164, green: 105, blue: 194 },
  guitar: { red: 215, green: 154, blue: 52 },
  bass: { red: 50, green: 166, blue: 151 },
  strings: { red: 204, green: 91, blue: 150 },
  ensemble: { red: 173, green: 111, blue: 188 },
  brass: { red: 220, green: 112, blue: 47 },
  reed: { red: 112, green: 167, blue: 65 },
  pipe: { red: 58, green: 168, blue: 108 },
  "synth lead": { red: 54, green: 155, blue: 202 },
  "synth pad": { red: 113, green: 111, blue: 203 },
  "synth effects": { red: 72, green: 135, blue: 188 },
  world: { red: 164, green: 166, blue: 55 },
  ethnic: { red: 164, green: 166, blue: 55 },
  percussive: { red: 214, green: 86, blue: 69 },
  percussion: { red: 214, green: 86, blue: 69 },
  "sound effects": { red: 121, green: 139, blue: 163 }
};

const lightnessVariants = [0, -12, 12];

export interface InstrumentFamilyPalette {
  solid: string;
  glow: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  text: string;
}

const trackNameFamilyHints: Array<[RegExp, string]> = [
  [/\b(bass|contrabass|double bass)\b/i, "bass"],
  [/\b(guitar|gtr|ukulele)\b/i, "guitar"],
  [/\b(drum|kit|percussion|perc)\b/i, "percussion"],
  [/\b(piano|keys|keyboard)\b/i, "piano"],
  [/\b(organ)\b/i, "organ"],
  [/\b(choir|vocal|voice|vox)\b/i, "ensemble"],
  [/\b(violin|viola|cello|string)\b/i, "strings"],
  [/\b(trumpet|trombone|horn|tuba|brass)\b/i, "brass"],
  [/\b(sax|clarinet|oboe|bassoon|reed)\b/i, "reed"],
  [/\b(flute|piccolo|recorder|pipe)\b/i, "pipe"],
  [/\b(synth|lead)\b/i, "synth lead"],
  [/\b(pad)\b/i, "synth pad"]
];

export function resolveInstrumentFamily(
  family: string,
  isDrums: boolean,
  trackName: string,
  hasNotes: boolean
): string {
  if (isDrums) {
    return "percussion";
  }
  if (hasNotes) {
    return family;
  }
  return (
    trackNameFamilyHints.find(([pattern]) => pattern.test(trackName))?.[1] ??
    family
  );
}

export function getInstrumentThumbnailIndex(
  family: string,
  isDrums: boolean
): number {
  return isDrums ? 14 : familyIndexes[family.toLowerCase()] ?? 12;
}

export function getInstrumentFamilyClass(
  family: string,
  isDrums: boolean
): string {
  const normalizedFamily = isDrums ? "percussion" : family.toLowerCase();
  return familyClassNames[normalizedFamily] ?? "sound-effects";
}

export function getInstrumentFamilyColor(
  family: string,
  isDrums: boolean,
  variant = 0
): string {
  return getInstrumentFamilyPalette(family, isDrums, variant).solid;
}

export function getInstrumentFamilyPalette(
  family: string,
  isDrums: boolean,
  variant = 0
): InstrumentFamilyPalette {
  const normalizedFamily = isDrums ? "percussion" : family.toLowerCase();
  const color = familyColors[normalizedFamily] ?? familyColors["sound effects"]!;
  const adjustment =
    lightnessVariants[Math.abs(variant) % lightnessVariants.length]!;
  const adjusted = {
    red: clampChannel(color.red + adjustment),
    green: clampChannel(color.green + adjustment),
    blue: clampChannel(color.blue + adjustment)
  };
  const text = mixColor(adjusted, { red: 242, green: 245, blue: 248 }, 0.68);
  const rgb = `${adjusted.red}, ${adjusted.green}, ${adjusted.blue}`;
  return {
    solid: `rgb(${rgb})`,
    glow: `rgba(${rgb}, 0.22)`,
    surface: `rgba(${rgb}, 0.46)`,
    surfaceStrong: `rgba(${rgb}, 0.68)`,
    border: `rgba(${rgb}, 0.9)`,
    text: `rgb(${text.red}, ${text.green}, ${text.blue})`
  };
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function mixColor(
  source: RgbColor,
  target: RgbColor,
  amount: number
): RgbColor {
  return {
    red: clampChannel(source.red + (target.red - source.red) * amount),
    green: clampChannel(source.green + (target.green - source.green) * amount),
    blue: clampChannel(source.blue + (target.blue - source.blue) * amount)
  };
}
