import type { Candidate, CandidateResult } from "./model";
import { WARM_SAMPLES } from "./model";

type Request = { candidate: Candidate };
type Progress = { kind: "progress"; completed: number };
type Done = { kind: "done"; result: CandidateResult };

const PASSWORD = "public-argon2id-benchmark-input-v1";
const SALT = new TextEncoder().encode("benchmark-salt01"); // Exactly 16 public bytes.

self.onmessage = async (event: MessageEvent<Request>) => {
  const { candidate } = event.data;
  const result: CandidateResult = {
    candidate,
    moduleLoadMs: null,
    coldMs: null,
    warmMs: [],
    errors: [],
    peakProcessMiB: null,
    observations: "",
  };
  try {
    const loadStart = performance.now();
    const { argon2id } = await import("hash-wasm");
    result.moduleLoadMs = performance.now() - loadStart;

    const derive = async (): Promise<number> => {
      const start = performance.now();
      const output = await argon2id({
        password: PASSWORD,
        salt: SALT,
        iterations: candidate.iterations,
        parallelism: candidate.parallelism,
        memorySize: candidate.memoryKiB,
        hashLength: candidate.hashLength,
        outputType: "binary",
      });
      const elapsed = performance.now() - start;
      if (output.length !== 32)
        throw new Error(`Expected 32 output bytes, got ${output.length}`);
      output.fill(0);
      return elapsed;
    };

    result.coldMs = await derive();
    for (let i = 0; i < WARM_SAMPLES; i++) {
      result.warmMs.push(await derive());
      self.postMessage({
        kind: "progress",
        completed: i + 1,
      } satisfies Progress);
    }
  } catch (error) {
    result.errors.push(
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error),
    );
  }
  self.postMessage({ kind: "done", result } satisfies Done);
};
