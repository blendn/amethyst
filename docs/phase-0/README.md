# Phase 0: security design

## Objective and status

Define Amethyst's security boundary and cryptographic protocol precisely enough
that browser and API implementations do not need to invent security-sensitive
behavior.

**Phase 0 is incomplete.** The running application is an unaudited educational
prototype. It implements a vertical slice before these documents were approved;
its persisted `version: 1` records are demo formats, not evidence that the draft
cryptographic protocol was implemented or approved. Do not store real credentials.

The [decision record](decision-record.md) covers the seven former open decisions
and differences between the documents and the demo. The
[Argon2id benchmark plan](argon2id-benchmark-plan.md) defines measurements needed
before choosing production parameters or a device floor.

## Deliverables

- [x] Draft threat model and security invariants
- [x] Draft cryptographic construction
- [x] Draft authentication/session design
- [x] Recovery policy
- [x] Draft protocol and migration rules
- [x] Deterministic test-vector plan
- [x] Record decisions and unresolved measurement/review gates
- [ ] Benchmark Argon2id on representative devices and set the support floor
- [ ] Obtain independent review of the protocol and deployment plan
- [ ] Generate and independently verify format-specific test vectors
- [ ] Record approval for a reviewed implementation phase

## Implementation boundary

The existing registration, vault persistence, and cryptography are provisional
demo code. New security-sensitive behavior must first have a documented format,
versioning and migration plan, and tests appropriate to the change. Do not change
the byte encoding or interpretation of existing persisted demo records in place.
Keep the educational-prototype warning visible until independent review. Approval
of this decision record is not a security audit.

## Exit criteria

Phase 0 is complete only when:

1. Every byte-level input to Argon2id, HKDF, and AES-GCM is specified for a new,
   unambiguous format version.
2. Test vectors are reproducible in two independent implementations.
3. All cryptographic failure behavior is defined and fail-closed.
4. The recovery and master-password-change behavior is accepted.
5. The threat model is reviewed against the actual deployment plan.
6. Device benchmarks, authentication review, and wire-format review have resolved
   the gates in the decision record.

Phase 0 approval would still not make Amethyst production-ready.
