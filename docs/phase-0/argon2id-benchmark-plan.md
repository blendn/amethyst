# Argon2id parameter and device-floor benchmark plan

Status: **measurement plan, not selected parameters or a support claim**.

## Purpose

Choose the strongest practical Argon2id parameters for the lowest supported
browser/device class without making registration or unlock unreliable. The demo
currently uses 65,536 KiB, 3 passes, parallelism 1. These are baseline test
points, not approved production values.

## Test matrix

- Use real, representative low-memory Android and iOS devices, plus mainstream
  desktop systems. Record model, RAM, OS, browser version, power mode, and whether
  the browser is cold or already running. Include the oldest supported browser
  candidates from the decision record.
- Exercise memory sizes 19,456, 32,768, 65,536, 131,072, and 262,144 KiB where
  a device can safely run them; passes 2, 3, and 4; parallelism 1 and 2. Do not
  run combinations beyond the client's safe allocation limit. Use a 16-byte salt,
  32-byte output, Argon2id v1.3, and the exact library/build intended for the
  browser. Never benchmark with a real master password.
- Measure initial module load, one cold derivation, and at least 20 warm
  derivations for each viable candidate. Repeat after backgrounding/resuming the
  tab, under memory pressure, and with a second active tab. Measure peak process
  memory when the platform exposes it; otherwise record observed termination,
  reload, or allocation failure. Track p50/p95 wall time, errors, and thermal
  throttling. Report load time separately from derivation time.
- Test registration, login, and unlock flows on every candidate browser. Confirm
  compatibility errors occur before account creation if required APIs or memory
  are unavailable.

## Selection and evidence

1. Reject any candidate with crashes, tab eviction, allocation failure, or
   unreliable repeated unlock on a proposed supported device.
2. Among reliable candidates, prefer the highest memory cost that meets a
   documented interactive latency budget on the slowest supported device; then
   choose passes and parallelism based on measured latency and review of
   offline-guessing cost. Proposed evaluation budget: warm p95 at most 2 seconds
   on the floor device, to be accepted or changed during review.
3. Record the chosen default, protocol minimum, and maximum accepted pre-login
   allocation separately. Reject values outside those bounds _before_ invoking
   Argon2id. Include downgrade and resource-exhaustion tests.
4. Save raw measurements, methodology, dependency versions, and reviewer sign-off
   with the decision record. If no candidate meets the budget reliably, raise the
   device floor or revise the budget explicitly; do not silently weaken the KDF.

Benchmark results alone do not establish security. Independent cryptographic and
deployment review remains required before freezing a protocol parameter set.
