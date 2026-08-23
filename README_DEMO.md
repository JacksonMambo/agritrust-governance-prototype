# AgriTrust demo guide

Five minutes, no setup. Open the [live demo](https://jacksonmambo.github.io/agritrust-governance-prototype/) or `index.html`, then pick a role.

State is held in memory and reseeds on reload, so nothing you do here persists or affects anyone else.

## Walkthrough

1. **Farmer.** Create a new delivery. Fill in the GS1 fields (GTIN, LOT, SSCC, and both GLNs) so the regulator search has something to find later.
2. **Buyer.** Open that delivery and dispute it. Give a reason code.
3. **Buyer.** Upload evidence. The file is not stored; its SHA-256 digest is computed and written to the ledger as an event.
4. **Buyer.** Submit the invoice, approve it, schedule payment, mark it paid. Watch the event list grow.
5. **Regulator.** Search by the GTIN or lot you entered. Open the delivery, take the current QR payload, and verify it against the ledger.
6. **Verify.** Run the chain for that delivery in **Normal** mode. It should return `PASS`. Switch to **Tamper** mode and run it again: the first event's stored content is altered and the recomputed hash no longer matches, so it returns `FAIL` naming the event and the reason.

Step 6 is the point of the whole thing. Try it on more than one delivery.

## What is real and what is not

**Real:** workflow state transitions, evidence digests, canonical hashing, per-delivery chain construction and verification, regulator filtering, CSV export.

**Simulated:** authentication, roles (selected from the URL fragment, with no access control), persistence, file storage, PDF generation.

## Verifying a hash yourself

The canonical form is deterministic, so any event's hash can be recomputed from the exported record without running this code. `test/ledger.test.mjs` includes a test that does exactly this. Run the suite with `npm test` on Node 18 or later.

## Provenance

Version 8.0.0 corrected two critical defects in the integrity mechanism, documented in [INTEGRITY.md](INTEGRITY.md). If you are evaluating this prototype, read that first.
