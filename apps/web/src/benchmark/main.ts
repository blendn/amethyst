import {
  matrix,
  MEMORY_KIB,
  percentile,
  WARM_SAMPLES,
  type Candidate,
  type CandidateResult,
  type Run,
} from "./model";

declare const __HASH_WASM_VERSION__: string;

const form = document.querySelector<HTMLFormElement>("#setup")!;
const status = document.querySelector<HTMLElement>("#status")!;
const results = document.querySelector<HTMLTableSectionElement>("#results")!;
const stopButton = document.querySelector<HTMLButtonElement>("#stop")!;
const downloadButton = document.querySelector<HTMLButtonElement>("#download")!;
const rawDetails = document.querySelector<HTMLDetailsElement>("#raw-details")!;
const rawJson = document.querySelector<HTMLTextAreaElement>("#raw-json")!;
const runs: Run[] = [];
let running = false;
let activeWorker: Worker | null = null;
let cancelActive: (() => void) | null = null;
let cancelled = false;

type WorkerMessage =
  | { kind: "progress"; completed: number }
  | { kind: "done"; result: CandidateResult };

function fixed(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function refreshRawJson(): void {
  rawJson.value = JSON.stringify({ schemaVersion: 1, runs }, null, 2);
}

function runCandidate(candidate: Candidate): Promise<CandidateResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    activeWorker = worker;
    const cleanup = () => {
      worker.terminate();
      activeWorker = null;
      cancelActive = null;
    };
    cancelActive = () => {
      cleanup();
      reject(new Error("Run stopped"));
    };
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.kind === "progress") {
        status.textContent = `${candidate.memoryKiB} KiB / ${candidate.iterations} passes / p=${candidate.parallelism}: warm ${event.data.completed}/${WARM_SAMPLES}`;
      } else {
        cleanup();
        resolve(event.data.result);
      }
    };
    worker.onerror = (event) => {
      cleanup();
      resolve({
        candidate,
        moduleLoadMs: null,
        coldMs: null,
        warmMs: [],
        errors: [`Worker error: ${event.message}`],
        peakProcessMiB: null,
        observations: "",
      });
    };
    worker.postMessage({ candidate });
  });
}

function addResult(run: Run, result: CandidateResult): void {
  const row = results.insertRow();
  const fields = [
    String(run.context.scenario),
    String(result.candidate.memoryKiB),
    String(result.candidate.iterations),
    String(result.candidate.parallelism),
    fixed(result.moduleLoadMs),
    fixed(result.coldMs),
    fixed(percentile(result.warmMs, 0.5)),
    fixed(percentile(result.warmMs, 0.95)),
    result.errors.join("; ") || "0",
  ];
  for (const field of fields) row.insertCell().textContent = field;

  const memory = document.createElement("input");
  memory.type = "number";
  memory.min = "0";
  memory.step = "0.1";
  memory.setAttribute("aria-label", "Peak process memory in MiB");
  memory.addEventListener("change", () => {
    result.peakProcessMiB = memory.value === "" ? null : Number(memory.value);
    refreshRawJson();
  });
  row.insertCell().append(memory);

  const notes = document.createElement("textarea");
  notes.rows = 2;
  notes.setAttribute("aria-label", "Observed failure and thermal notes");
  notes.addEventListener("input", () => {
    result.observations = notes.value;
    refreshRawJson();
  });
  row.insertCell().append(notes);
  refreshRawJson();
}

function contextFromForm(): Record<string, string | number | boolean | null> {
  const data = new FormData(form);
  const value = (name: string) => String(data.get(name) ?? "").trim();
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  return {
    deviceModel: value("deviceModel"),
    ramGiB: Number(value("ramGiB")),
    os: value("os"),
    browser: value("browser"),
    powerMode: value("powerMode"),
    browserState: value("browserState"),
    scenario: value("scenario"),
    buildId: value("buildId"),
    safeCapKiB: Number(value("safeCapKiB")),
    notes: value("notes"),
    userAgent: navigator.userAgent,
    deviceMemoryHintGiB: deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    secureContext: window.isSecureContext,
    webAssembly: typeof WebAssembly !== "undefined",
    cryptoGetRandomValues:
      typeof globalThis.crypto?.getRandomValues === "function",
    webCryptoSubtle: typeof globalThis.crypto?.subtle !== "undefined",
    pageMode: import.meta.env.MODE,
    hashWasmVersion: __HASH_WASM_VERSION__,
    argon2Version: "1.3",
    saltBytes: 16,
    outputBytes: 32,
    warmSamplesRequested: WARM_SAMPLES,
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (running || !form.reportValidity()) return;
  let context: Run["context"];
  let candidates: Candidate[];
  try {
    context = contextFromForm();
    candidates = matrix(Number(context.safeCapKiB));
  } catch (error) {
    status.textContent = String(error);
    return;
  }
  const run: Run = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    context,
    results: [],
    skippedMemoryKiB: MEMORY_KIB.filter(
      (size) => size > Number(context.safeCapKiB),
    ),
    completed: false,
  };
  runs.push(run);
  running = true;
  cancelled = false;
  stopButton.disabled = false;
  form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled =
    true;
  try {
    for (const candidate of candidates) {
      if (cancelled) break;
      status.textContent = `Running ${candidate.memoryKiB} KiB / ${candidate.iterations} passes / p=${candidate.parallelism}`;
      const result = await runCandidate(candidate);
      run.results.push(result);
      addResult(run, result);
      // A failed allocation at one memory size makes every larger size unsafe.
      if (result.errors.length > 0 && result.warmMs.length < WARM_SAMPLES) {
        const unsafeFrom = candidate.memoryKiB;
        const remaining = candidates.filter(
          (item) =>
            item.memoryKiB >= unsafeFrom &&
            !run.results.some((done) => done.candidate === item),
        );
        run.skippedMemoryKiB = [
          ...new Set([
            ...run.skippedMemoryKiB,
            ...remaining.map((item) => item.memoryKiB),
          ]),
        ];
        status.textContent = `Stopped at ${unsafeFrom} KiB after an error. Export and inspect the raw result.`;
        break;
      }
    }
    run.completed = !cancelled && run.results.length === candidates.length;
  } catch (error) {
    status.textContent = String(error);
  } finally {
    run.finishedAt = new Date().toISOString();
    refreshRawJson();
    if (run.completed)
      status.textContent = `Completed ${run.results.length} candidates. Add observed process memory and notes, then download JSON.`;
    running = false;
    stopButton.disabled = true;
    form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled =
      false;
  }
});

stopButton.addEventListener("click", () => {
  cancelled = true;
  cancelActive?.();
  activeWorker?.terminate();
  status.textContent =
    "Run stopped. Completed candidates remain available for export.";
});

downloadButton.addEventListener("click", () => {
  if (runs.length === 0) {
    status.textContent = "Run at least one candidate before downloading.";
    return;
  }
  refreshRawJson();
  rawDetails.open = true;
  const blob = new Blob([rawJson.value], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `argon2id-browser-benchmarks-${new Date().toISOString().replaceAll(":", "-")}.json`;
  document.body.append(link);
  link.click();
  status.textContent =
    "Download requested. If no file appears, copy the Raw JSON below before closing this tab.";
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
});
