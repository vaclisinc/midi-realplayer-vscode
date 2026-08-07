export type RulerSubdivision = 1 | 2 | 4;

/**
 * Keeps ruler details useful at every horizontal zoom level without turning
 * the header into a dense barcode.
 */
export function chooseRulerSubdivision(
  quarterNoteWidth: number
): RulerSubdivision {
  if (quarterNoteWidth >= 48) {
    return 4;
  }
  if (quarterNoteWidth >= 24) {
    return 2;
  }
  return 1;
}

export function getRulerTickLength(
  kind: "measure" | "beat" | "subdivision"
): number {
  switch (kind) {
    case "measure":
      return 12;
    case "beat":
      return 7;
    case "subdivision":
      return 4;
  }
}
