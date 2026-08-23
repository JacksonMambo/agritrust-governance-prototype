# AgriTrust

**Governance infrastructure for agrifood risk and payment discipline.**

A working prototype of the coordination layer that deferred-payment agrifood supply chains lack: capture a delivery, contest it with evidence, sequence the invoice, and leave a per-delivery event chain that a regulator or auditor can verify independently.

**Live demo:** https://jacksonmambo.github.io/agritrust-governance-prototype/
**Version:** 8.0.0 · **Ledger schema:** `agritrust.ledger/8.0.0` · **Licence:** MIT

---

## The problem it addresses

A smallholder delivers to a buyer on thirty-day terms. The delivery is disputed on quality three weeks later. There is no shared, timestamped record of what was delivered, when it was contested, on what evidence, or where the invoice sits. The dispute is resolved by whoever has more market power, and the payment discipline that formal contracts assume never materialises.

AgriTrust models that sequence as an append-only chain of events, each hash-linked to the previous event of the same delivery, so that the record of a transaction cannot be edited after the fact without detection.

## What it demonstrates

| Role | Capability |
|---|---|
| **Farmer** | Record deliveries with GS1 identifiers (GTIN, LOT, SSCC, GLN); track terms and due dates |
| **Buyer** | Confirm or dispute; anchor supporting evidence as a SHA-256 digest; move the invoice through submission, approval, scheduling and payment |
| **Regulator** | Read-only traceability search by GTIN, lot or GLN; verify a QR payload against the ledger; export results |
| **Verify** | Recompute the full chain for a delivery and show `PASS` or `FAIL` with the failing event and reason |

Workflow states, evidence anchoring and chain verification are real and computed in the browser. **Authentication, persistence, file storage and PDF generation are simulated.** Roles are selected from the URL fragment; there is no access control. This is a demonstration of governance logic, not a deployable system.

## Ledger design

Each delivery carries its own hash chain. An event is:

```json
{
  "id": 1,
  "schema": "agritrust.ledger/8.0.0",
  "ts": "2026-02-11T09:14:22.104Z",
  "event_type": "DELIVERY_CREATED",
  "actor_user_id": "U-FARM-01",
  "delivery_ref": "D00007",
  "data_json": "{\"product\":\"Spinach\",\"qty\":200,\"gtin\":\"00012345678905\"}",
  "prev_hash": null,
  "hash": "4fc54ca3…"
}
```

`hash` is `SHA-256` over a canonical serialisation of `{event_type, actor_user_id, delivery_ref, data, prev_hash}`, with object keys sorted recursively at every level. Because the canonical form is deterministic and the payload fields are exported with the event, **a third party can recompute any hash from an exported record without running this code** — which is the only sense in which a claim of auditability means anything. A regression test asserts exactly that.

Verification walks the chain for one delivery, checks that each `prev_hash` matches its predecessor, and recomputes each hash from stored content.

## Integrity review

Version 8.0.0 is the outcome of a self-audit that found five defects in v7, two of them critical, including one that meant **event content was never covered by the hash at all**. The audit, the measurements and the fixes are documented in full:

**→ [INTEGRITY.md](INTEGRITY.md)**

Every defect is now covered by a test that fails against v7 and passes against v8.

## Scope: this is not an AI system

The prototype performs hashing, workflow state transitions and identifier lookup. There is no inference anywhere in it. Under the OECD definition of an AI system, and under the [AI-D2V](https://auctusagri.com) appraisal framework's scope gate, AgriTrust is digital infrastructure and should be appraised as ordinary technology rather than as AI. It is included here as a worked example of that boundary, applied to the author's own artefact.

## Running it

Any static server, or open `index.html` directly.

```bash
git clone https://github.com/JacksonMambo/agritrust-governance-prototype.git
cd agritrust-governance-prototype
python3 -m http.server 8080     # then visit http://localhost:8080
```

Tests require Node 18 or later and have no dependencies:

```bash
npm test
```

A five-minute guided walkthrough is in [README_DEMO.md](README_DEMO.md).

## Repository layout

```
index.html              role selection and disclosure
portal.html             the application shell
recall.html             recall drill view
assets/js/ledger.js     ledger core: canonical hashing, append, verify (shared with tests)
assets/js/app.js        application logic, rendering, audit pack
assets/styles.css       styling
test/ledger.test.mjs    regression tests for every defect in INTEGRITY.md
```

## Related research

This prototype is the practical counterpart to the argument that verification mechanisms are necessary but not sufficient:

> Mambozoukuni, J. (2026). When verification is not enough: institutional preconditions for blockchain-enabled payment discipline in smallholder agricultural value chains. *Frontiers in Sustainable Food Systems*, 10:1893984. [doi:10.3389/fsufs.2026.1893984](https://doi.org/10.3389/fsufs.2026.1893984)

The prototype builds the verification layer that paper describes; the paper explains why building it is not the hard part.

## Citation

See [CITATION.cff](CITATION.cff), or:

> Mambozoukuni, J. (2026). *AgriTrust: a governance-infrastructure prototype for agrifood risk and payment discipline* (v8.0.0). https://github.com/JacksonMambo/agritrust-governance-prototype

## Author

**Jackson Mambozoukuni** · Auctus Agri, East London, South Africa
ORCID [0009-0009-9343-1910](https://orcid.org/0009-0009-9343-1910) · Registered Natural Scientist (SACNASP 117797)

Originally developed for the Valar Institute Executive MBA capstone, 2026. Released for open scrutiny under the MIT Licence.

*Digital records support coordination and audit visibility. They do not replace regulatory inspection.*
