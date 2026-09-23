# Running the Argon2id browser benchmark

This harness implements the [measurement plan](argon2id-benchmark-plan.md). It
does not select or change production KDF parameters. It runs the same `hash-wasm`
Argon2id package as the web client (`4.12.0` in the current lockfile), with a
public synthetic password, 16-byte salt, 32-byte binary output, and the plan's
memory/pass/parallelism matrix. The library implements Argon2id v1.3. Never use a
real master password.

## Prepare a reproducible build

From a recorded commit, install with `npm ci`, then build the web app with
`npm run build -w @amethyst/web`. Serve `apps/web/dist` over HTTPS or localhost
and open `/benchmark.html`. For local testing, `npm run dev -w @amethyst/web` also
works, but use the production build for comparable results. Record the commit and
dependency lockfile version in the exported run. Keep browser caches and network
conditions consistent when comparing module-load times.

The browser worker imports the library on each candidate and then performs one
cold derivation and 20 warm derivations. Module-load timing covers the dynamic
JavaScript import; the first derivation includes Argon2 WebAssembly initialization.
Each candidate gets a fresh worker. Browser HTTP/module caches can remain warm
across candidates and runs; use a fresh browser session when measuring a truly cold
load. The harness records raw times in milliseconds and displays interpolated p50
and p95 from the 20 warm samples. A worker error stops the remaining candidates at
that and higher memory sizes. A tab crash/reload may prevent an export, so note it
immediately in the device log and rerun at a lower cap.

## On each device and browser

1. Record device model, actual RAM, OS and browser versions, power mode, browser
   state, build ID, and the scenario. Use the oldest browser candidates from the
   [decision record](decision-record.md), along with representative low-memory
   Android/iOS and desktop systems.
2. Establish a safe Argon2 allocation cap on that device. Enter it before running;
   the harness skips every larger memory size. Start at 19,456 KiB and raise the
   cap only after checking for terminations or reloads. Do not treat reported
   `navigator.deviceMemory` as an allocation guarantee.
3. Run the baseline matrix. Repeat in an already-running browser, after
   background/resume, under memory pressure, and with a second active tab. Describe
   the exact setup and thermal behavior in the notes. Stop on overheating or
   repeated failure.
4. Enter peak **process** memory in each result row if the OS/browser exposes it.
   Leave it blank when unavailable. Browser JS-heap statistics are not process
   memory. Record allocation failures, tab eviction/reload, and throttling in the
   observations field. Download the JSON after every scenario; it contains the
   full ordered samples, errors, metadata, skipped sizes, and completion status.
   If the browser does not save the file, expand **Raw JSON** and copy its contents
   before closing the tab.
5. On each candidate browser, test registration, login, and unlock with disposable
   accounts. Record pass/fail and error details alongside the raw JSON. Check that
   missing WebAssembly, CSPRNG, WebCrypto AES-GCM/HKDF, or safe memory produces a
   compatibility error **before** account creation. This is a manual compatibility
   test; the benchmark page does not create accounts.

Keep raw JSON, the device log, browser/build details, and reviewer sign-off with
the [decision record](decision-record.md). The proposed floor-device budget is
warm p95 at most 2 seconds, subject to review. Reject candidates that crash or
fail repeated unlock; benchmark timings alone do not establish device support or
security.
