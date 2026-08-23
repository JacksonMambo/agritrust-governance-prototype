/* ============================================================================
   AgriTrust ledger core
   Schema: agritrust.ledger/8.0.0

   Pure, dependency-free hash-chain functions shared by the browser prototype
   and the Node test suite. No DOM access, no global state: every function
   takes the ledger array it operates on.

   See INTEGRITY.md for the v7 defects this version corrects.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AgriTrustLedger = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var LEDGER_SCHEMA = "agritrust.ledger/8.0.0";

  function subtle() {
    if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
      return globalThis.crypto.subtle;
    }
    throw new Error("WebCrypto SubtleCrypto is not available in this environment.");
  }

  /* Canonical JSON: keys sorted recursively, whole value covered.

     v7 used JSON.stringify(payload, Object.keys(payload).sort()). The second
     argument to JSON.stringify is a replacer ALLOWLIST applied at every level,
     not a key-ordering argument, so the keys inside `data` were filtered out
     and every event serialised as {"data":{}, ...}. Event content was therefore
     excluded from the hash and the ledger was not tamper-evident. */
  function canon(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(canon).join(",") + "]";
    return "{" + Object.keys(value).sort()
      .map(function (k) { return JSON.stringify(k) + ":" + canon(value[k]); })
      .join(",") + "}";
  }

  async function sha256Hex(str) {
    var buf = new TextEncoder().encode(str);
    var hb = await subtle().digest("SHA-256", buf);
    return Array.from(new Uint8Array(hb))
      .map(function (b) { return b.toString(16).padStart(2, "0"); })
      .join("");
  }

  /* The bytes that are hashed for one event. Exported so an external auditor
     can recompute a hash from an exported record without reading this file. */
  function eventPayload(event_type, actor_user_id, delivery_ref, data, prev_hash) {
    return {
      event_type: event_type,
      actor_user_id: actor_user_id,
      delivery_ref: delivery_ref,
      data: data,
      prev_hash: prev_hash
    };
  }

  function eventsFor(ledger, delivery_ref) {
    return ledger
      .filter(function (e) { return e.delivery_ref === delivery_ref; })
      .slice()
      .sort(function (a, b) { return a.id - b.id; });
  }

  /* Append one event. Each delivery carries its own chain: prev_hash points at
     the previous event OF THAT DELIVERY. v7 linked to the last event in the
     whole ledger while verification checked linkage within a single delivery,
     so every delivery after the first failed on untampered data. */
  async function appendEvent(ledger, event_type, actor_user_id, delivery_ref, data) {
    var chain = eventsFor(ledger, delivery_ref);
    var last = chain.length ? chain[chain.length - 1] : null;
    var prev_hash = last ? last.hash : null;
    var hash = await sha256Hex(
      canon(eventPayload(event_type, actor_user_id, delivery_ref, data, prev_hash))
    );
    ledger.push({
      id: ledger.length + 1,
      schema: LEDGER_SCHEMA,
      ts: new Date().toISOString(),
      event_type: event_type,
      actor_user_id: actor_user_id,
      delivery_ref: delivery_ref,
      data_json: JSON.stringify(data),
      prev_hash: prev_hash,
      hash: hash
    });
    return hash;
  }

  /* Recompute every event hash from its stored content and compare.

     `simulateTamper` mutates the RECORD, as an attacker would, and lets the
     recomputed hash disagree on its own. v7 never recomputed a hash here, and
     its tamper mode pushed a failure whenever a flag was set, so it
     demonstrated the flag rather than the integrity property. */
  async function verifyChain(ledger, delivery_ref, simulateTamper) {
    var events = eventsFor(ledger, delivery_ref);
    var failures = [];
    var prev = null;

    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      var expectedPrev = prev ? prev.hash : null;

      if (e.prev_hash !== expectedPrev) {
        failures.push({
          index: i, event_id: e.id, reason: "PREV_HASH_MISMATCH",
          expected: expectedPrev, found: e.prev_hash
        });
      }

      var data = {};
      try { data = JSON.parse(e.data_json || "{}"); } catch (_) { data = {}; }

      if (simulateTamper && i === 0) {
        data = Object.assign({}, data, {
          qty: (Number(data.qty) || 0) + 1,
          _demo_tampered: true
        });
      }

      var computed = await sha256Hex(
        canon(eventPayload(e.event_type, e.actor_user_id, e.delivery_ref, data, e.prev_hash))
      );

      if (computed !== e.hash) {
        failures.push({
          index: i, event_id: e.id, reason: "HASH_MISMATCH",
          computed: computed.slice(0, 16) + "...",
          stored: (e.hash || "").slice(0, 16) + "..."
        });
      }

      prev = e;
    }

    return {
      schema: LEDGER_SCHEMA,
      status: failures.length ? "FAIL" : "PASS",
      total_events: events.length,
      failures: failures,
      first_hash: events.length ? events[0].hash : null,
      latest_hash: events.length ? events[events.length - 1].hash : null
    };
  }

  return {
    LEDGER_SCHEMA: LEDGER_SCHEMA,
    canon: canon,
    sha256Hex: sha256Hex,
    eventPayload: eventPayload,
    eventsFor: eventsFor,
    appendEvent: appendEvent,
    verifyChain: verifyChain
  };
});
