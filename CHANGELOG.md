# Changelog

All notable changes to this prototype. Versions follow [semantic versioning](https://semver.org/).

## [8.0.0] - 2026-08-23

Integrity release. Full audit in [INTEGRITY.md](INTEGRITY.md).

**Breaking.** Ledger hashes computed under v8.0.0 are not comparable with hashes computed under v7. Events now carry a `schema` field (`agritrust.ledger/8.0.0`) so the two can be told apart.

### Fixed
- **Event content is now covered by the hash.** v7 hashed with `JSON.stringify(payload, Object.keys(payload).sort())`, whose array argument is a replacer allowlist applied at every level rather than a key-order argument. All keys inside `data` were filtered out and every event hashed as `{"data":{}, ...}`, so product, quantity and every GS1 identifier could be altered without changing the hash. Replaced with a recursive canonical serialiser.
- **Verification now recomputes hashes.** The live `verifyChain` contained no call to `sha256Hex` and checked only `prev_hash` linkage.
- **Chains are scoped per delivery.** `appendEvent` linked to the last event in the whole ledger while `verifyChain` expected linkage within a single delivery, so every delivery after the first failed on untampered data.
- **Tamper demonstration mutates the record** instead of corrupting the stored hash or pushing an unconditional failure. The previous approach was a no-op in 6.6% of cases, measured.
- Audit pack status is derived from an actual chain verification.

### Changed
- Ledger core extracted to `assets/js/ledger.js`, shared by the browser and the test suite.
- Application logic extracted from inline `<script>` in `portal.html` to `assets/js/app.js`.
- Version strings and cache-busting parameters aligned to `8.0.0`.

### Added
- `test/ledger.test.mjs` — 11 regression tests, no dependencies, `npm test`.
- `INTEGRITY.md`, `CHANGELOG.md`, `CITATION.cff`, `LICENSE` (MIT), `package.json`.
- Full `README.md` replacing a one-line placeholder.

### Removed
- `assets/js/ui.js` — 865 lines of orphaned code that `portal.html` never loaded and which had drifted from the live implementation.

### Known
- `assets/js/qrcode_min.js` is retained but not currently referenced; the audit pack renders the QR payload as JSON rather than as a scannable code.
- Roles are read from the URL fragment. There is no access control, by design, and this is disclosed in the interface.

## [7.x] - 2026
Capstone demonstration builds. Workflow, dispute handling, regulator search, QR payload concept and audit pack.
