# AgriTrust HTML Prototype v2 — Demo Guide

Open `index.html` and select a role.
This is a static prototype with simulated backend logic (ledger hashing, evidence hashing, workflow states).
Production implementation exists in Flask.

Quick demo (3–5 minutes):
1) FARMER: New delivery (include GTIN/LOT/GLN fields)
2) BUYER: Confirm or dispute
3) BUYER: Upload evidence → SHA-256 stored + ledger event
4) BUYER: Submit invoice → approve → schedule → paid
5) REGULATOR: Use current QR → Verify QR vs ledger
6) VERIFY: Normal PASS → Tamper FAIL

Deliverable scope:
- Demonstrates workflow logic, governance principles, and auditability.
- Does not generate real PDFs nor real authentication (server-side in Flask).
