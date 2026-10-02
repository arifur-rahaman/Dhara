# Permission suite

One test per permission rule (P1–P14) per role, at API level and for UI visibility. Each test asserts both the decision and that forbidden fields (client phone, email, NID, address) are absent from the JSON.

The suite starts in M1 with `src/server/authz/`. Run it with `pnpm test:perm`; CI requires it to pass.
