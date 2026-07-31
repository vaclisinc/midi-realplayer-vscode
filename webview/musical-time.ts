import type { TimeSignatureChange } from "./canonical-midi.ts";

export function ticksToMeasures(
  ticks: number,
  ppq: number,
  signatures: readonly TimeSignatureChange[]
): number {
  let measures = 0;
  let cursor = 0;
  let signature = signatures[0] ?? {
    ticks: 0,
    numerator: 4,
    denominator: 4
  };

  for (const next of signatures.slice(1)) {
    if (next.ticks >= ticks) {
      break;
    }
    measures +=
      (next.ticks - cursor) / ticksPerMeasure(ppq, signature);
    cursor = next.ticks;
    signature = next;
  }
  return measures + (ticks - cursor) / ticksPerMeasure(ppq, signature);
}

export function signatureAtTick(
  ticks: number,
  signatures: readonly TimeSignatureChange[]
): TimeSignatureChange {
  let current = signatures[0] ?? {
    ticks: 0,
    numerator: 4,
    denominator: 4
  };
  for (const signature of signatures) {
    if (signature.ticks > ticks) {
      break;
    }
    current = signature;
  }
  return current;
}

function ticksPerMeasure(
  ppq: number,
  signature: Pick<TimeSignatureChange, "numerator" | "denominator">
): number {
  return ppq * signature.numerator * (4 / signature.denominator);
}
