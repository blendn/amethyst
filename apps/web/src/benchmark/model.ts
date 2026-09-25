export const MEMORY_KIB = [19_456, 32_768, 65_536, 131_072, 262_144] as const;
export const PASSES = [2, 3, 4] as const;
export const PARALLELISM = [1, 2] as const;
export const WARM_SAMPLES = 20;

export type Candidate = {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  hashLength: 32;
};

export type CandidateResult = {
  candidate: Candidate;
  moduleLoadMs: number | null;
  coldMs: number | null;
  warmMs: number[];
  errors: string[];
  peakProcessMiB: number | null;
  observations: string;
};

export type Run = {
  startedAt: string;
  finishedAt: string | null;
  context: Record<string, string | number | boolean | null>;
  results: CandidateResult[];
  skippedMemoryKiB: number[];
  completed: boolean;
};

export function matrix(safeCapKiB: number): Candidate[] {
  if (
    !Number.isInteger(safeCapKiB) ||
    safeCapKiB < MEMORY_KIB[0] ||
    safeCapKiB > 262_144
  ) {
    throw new Error(
      "Enter a safe allocation cap between 19,456 and 262,144 KiB.",
    );
  }
  return MEMORY_KIB.filter((memoryKiB) => memoryKiB <= safeCapKiB).flatMap(
    (memoryKiB) =>
      PASSES.flatMap((iterations) =>
        PARALLELISM.map((parallelism) => ({
          memoryKiB,
          iterations,
          parallelism,
          hashLength: 32 as const,
        })),
      ),
  );
}

export function percentile(values: number[], percent: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const rank = (ordered.length - 1) * percent;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return ordered[low]! + (ordered[high]! - ordered[low]!) * (rank - low);
}
