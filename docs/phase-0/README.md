# Phase 0: security design

## Objective

Define Amethyst's security boundary and cryptographic protocol precisely enough
that browser and API implementations do not need to invent security-sensitive
behavior.

## Deliverables

- [x] Threat model and security invariants
- [x] Version 1 cryptographic construction
- [x] Authentication/session design
- [x] Recovery policy
- [x] Protocol and migration rules
- [x] Deterministic test-vector plan
- [ ] Resolve the open decisions listed below
- [ ] Obtain review by someone other than the protocol author
- [ ] Generate and independently verify version 1 test vectors
- [ ] Record approval to begin Phase 1

## Frozen implementation boundary

Until Phase 0 is approved, do not implement registration, vault persistence, or
cryptographic operations. Prototypes used to generate test vectors must remain
isolated from production code.

## Open decisions

1. Browser support floor, especially the lowest-memory supported mobile device.
2. Final Argon2id parameters after benchmarks on representative devices.
3. Whether v1 authentication uses the derived-secret verifier described here or
   waits for a mature, audited OPAQUE implementation.
4. Canonical serialization choice: deterministic CBOR is preferred; canonical
   JSON is the fallback if interoperability costs are too high.
5. Tombstone retention period and full-resync behavior.
6. Whether account email is case-folded only for lookup or normalized further.
7. Whether encrypted local caching is enabled by default.

## Exit criteria

Phase 0 is complete only when:

1. Every byte-level input to Argon2id, HKDF, and AES-GCM is specified.
2. Test vectors are reproducible in two independent implementations.
3. All cryptographic failure behavior is defined and fail-closed.
4. The recovery and master-password-change behavior is accepted.
5. The threat model is reviewed against the actual deployment plan.
6. Open decisions that affect the wire format have recorded answers.

Approval does not constitute a security audit. Amethyst must remain clearly
labelled as educational software until it receives appropriate review.
