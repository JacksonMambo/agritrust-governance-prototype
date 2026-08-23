# Integrity review, v7 to v8.0.0

This file records a self-audit of the AgriTrust prototype carried out on 23 August 2026, the defects it found, and what was changed. It is published because the artefact makes an integrity claim, and an integrity claim that has never been tested against its own implementation is a marketing claim.

Every defect below was present in the version that ran publicly at `jacksonmambo.github.io/agritrust-governance-prototype` up to and including v7. Each is now covered by a regression test in `test/ledger.test.mjs` that fails against the old implementation and passes against the new one.

---

## D1. Event content was not covered by the hash

**Severity: critical. The central claim of the artefact was false.**

Events were hashed like this:

```js
const json = JSON.stringify(payload, Object.keys(payload).sort());
const hash = await sha256Hex(json);
```

The intent was to canonicalise key order. `JSON.stringify` has no key-order parameter. When its second argument is an array it is a **replacer allowlist**, and the allowlist is applied at every level of the object. The keys inside `data` (`product`, `qty`, `gtin`, `lot_number`, `gln_farmer`, `due_date`) were not in the top-level allowlist and were therefore removed. Every event serialised as:

```
{"actor_user_id":"U-FARM-01","data":{},"delivery_ref":"D00007","event_type":"DELIVERY_CREATED","prev_hash":null}
```

`data` is empty. The consequence, measured:

```
original data: {"product":"Spinach","qty":200,"gtin":"00012345678905","lot_number":"LOT-A"}
tampered data: {"product":"GOLD BARS","qty":999999,"gtin":"99999999999999","lot_number":"LOT-FAKE"}
original hash: 4fc54ca3690c869ba1a0c704ba5441b121810e0ac6e0d7c91c6f44264640f624
tampered hash: 4fc54ca3690c869ba1a0c704ba5441b121810e0ac6e0d7c91c6f44264640f624
```

Identical. Product, quantity and every GS1 identifier could be altered without changing the hash, and verification returned `PASS`. Only `event_type`, `actor_user_id`, `delivery_ref` and `prev_hash` were protected.

**Fix.** A recursive canonical serialiser in `assets/js/ledger.js` that sorts keys at every level and covers the whole payload. Hashes produced under `agritrust.ledger/8.0.0` are not comparable with hashes produced under v7, so every event now carries its schema version.

The evidence-upload hash was never affected: `sha256Hex(filename + "|" + contents + "|" + delivery_ref)` was, and remains, content-bound.

---

## D2. Verification never recomputed a hash

**Severity: critical.**

The live `verifyChain` in `portal.html` contained no call to `sha256Hex`. It compared `prev_hash` linkage and nothing else, so a record could be edited freely without detection even had D1 not existed. The two defects were independent and either alone would have voided the claim.

**Fix.** `verifyChain` now recomputes every event hash from its stored content and compares it with the recorded hash, reporting both values on mismatch.

---

## D3. The chain and the verifier disagreed about what the chain was

**Severity: high. Clean data failed verification.**

`appendEvent` linked each new event to the last event in the **entire ledger**. `verifyChain` filtered to a **single delivery** and expected each event's `prev_hash` to point at the previous event of that delivery. On the shipped seed data:

```
verifyChain("D00007") -> PASS
verifyChain("D00006") -> FAIL  ["PREV_HASH_MISMATCH","PREV_HASH_MISMATCH"]
verifyChain("D00005") -> FAIL  ["PREV_HASH_MISMATCH"]
```

No tampering involved. Only the first delivery in the ledger could pass. The demo script in `README_DEMO.md` walked a reviewer past this, because the default selection was the one delivery that happened to verify.

**Fix.** Each delivery carries its own chain. `prev_hash` points at the previous event of the same delivery, which is what the verifier and the per-delivery QR payload both assume. A regression test appends interleaved events across two deliveries and requires both to verify.

---

## D4. The tamper demonstration demonstrated the wrong thing

**Severity: high, and specific to the demo's persuasive purpose.**

Two implementations existed. The live one was:

```js
if(simulateTamper && i===0) failures.push({reason:"HASH_MISMATCH"});
```

An unconditional failure whenever a flag was set. Nothing was tampered with and nothing was detected.

The other, in the orphaned `assets/js/ui.js`, corrupted the **stored hash** rather than the record:

```js
const stored = (simulateTamper && i===0) ? (e.hash.slice(0,-1)+"0") : e.hash;
```

That demonstrates "a wrong hash is noticed" rather than "an edited record is noticed", which is the property that matters. It also silently does nothing when the hash already ends in `0`. Measured over 3,000 hashes, that is **6.6%** of cases: roughly one demonstration in fifteen would have shown `PASS` in tamper mode.

**Fix.** Tamper mode now mutates the record, as an attacker would, and lets the recomputed hash disagree on its own. A regression test runs 200 independent chains and requires `FAIL` on every one.

---

## D5. Two divergent copies of the application

**Severity: medium, structural.**

`assets/js/ui.js` held 865 lines implementing the whole application. `portal.html` never loaded it and carried its own 680-line inline implementation instead. The two had drifted apart: `ui.js` recomputed hashes during verification while the live code did not, and their tamper modes differed. Anyone reading the repository to understand the system would most likely read the file that never executed.

**Fix.** The ledger core is extracted to `assets/js/ledger.js`, shared by the browser and the Node test suite. Application code lives in `assets/js/app.js` and is loaded by `portal.html`. The orphaned `ui.js` is deleted.

---

## What was not changed

The prototype is still a demonstration. Authentication remains simulated, roles are still selected from the URL fragment, state is in memory only, and there is no server. Those limits were disclosed before and remain disclosed. What changed is that the integrity mechanism now does what the interface says it does.

## Why this is published rather than quietly patched

The prototype accompanies research arguing that verification mechanisms are not sufficient on their own, and it sits alongside a separate framework for appraising whether technology claims are supported by evidence. Applying that standard selectively, to other people's systems but not to one's own, would be the more serious defect. The versioned record is the point.

---

*Jackson Mambozoukuni, 23 August 2026. Method note: defects were confirmed by reimplementing the shipped logic in Node and executing it, not by reading alone.*
