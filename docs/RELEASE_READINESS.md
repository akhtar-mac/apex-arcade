# Release readiness

Classification: **PARTIALLY VERIFIED**

Production release is **not legally or operationally authorised**. Technical checks in this repository do not change that.

## Why this is not fully verified

A new disposable database accepted all 7 migrations. The simulated desk flow, session revocation, agent permission checks, shared Redis limits, and a restore smoke test have command evidence. Render CLI validation, a hosted GitHub run of this tree, an Android device launch, alert delivery, an external security test, legal review, payment approval, live OTP, named operators, a retention period, and an agreed capacity target do not.

`ENABLE_REGULATED_FEATURES` remains `false` in `render.yaml`. A test process may set it true only with `NODE_ENV=test` against a disposable database. Do not copy that process into a public host.

## Release gate

All of the following must exist before any real-money switch can be considered:

1. A written legal opinion that the exact operation is lawful under the law and court orders then in force.
2. Server-side age and geographic enforcement that matches that opinion.
3. An authorised payment arrangement. A QR list in the admin screen is not that arrangement.
4. Separate admin and agent operators, strong credentials, and tested session revocation.
5. An external security test with release-blocking findings closed.
6. Named privacy, retention, incident, tax, backup, and deploy owners.
7. A restore test against a copy of the database that would actually be used, with an agreed RPO and RTO.
8. A signed Android artifact from an owner-held key, if a store build is in scope.
9. A measured staging workload with targets agreed before the run.
10. A separate human release decision. No frontend flag and no CI pass may bypass this list.

## Reproduce the checks that passed

```
npm test
npm run scan:secrets
npm run audit:deps
API_BASE=http://127.0.0.1:4010 TEST_OTP=654321 ADMIN_PASSWORD='<local test password>' npm run test:integration
./scripts/backup-disposable.sh
```

The integration command requires the disposable API and database described in `docs/TEST_REPORT.md`. Do not point it at a hosted database.
