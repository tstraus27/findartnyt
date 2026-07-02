# Data Directory

## Canonical Store

`exhibit-records.json` is the temporary canonical JSON store until a durable database is introduced.

Only reviewed and approved records should be promoted into this file. Ingestion should write proposals to `data/staging` first, not directly overwrite canonical records.

Current shape:

```json
{
  "records": []
}
```

Approved exhibition records should follow `schemas/exhibition.schema.json`.

Source configs under `scripts/exhibit-ingest/sources/` should follow `schemas/exhibition-source.schema.json` and are validated before fetch/parse work begins.

## Staging

`staging/` contains generated review reports. These reports are the human-review queue for new candidates, proposed updates, possible duplicates, and future conflicts.

Staging reports should follow `schemas/exhibition-staging.schema.json` and are validated during ingestion.

Use `scripts/exhibit-ingest/review-staging.mjs` for reviewer outputs. The default mode prints grouped text sections for humans, plus readiness blockers, minimum-field coverage, and recommended field-coverage warnings. `--json` emits the same grouped sections and readiness metadata as machine-readable JSON without changing staged statuses or canonical data.

When a live source verification run should not overwrite the default review artifact, use `scripts/exhibit-ingest/ingest.mjs --stage --output ...` to write a separate staging file, then compare it with `scripts/exhibit-ingest/compare-staging.mjs`.

Run source-specific staging and review commands sequentially. They share the same staging artifact, so parallel runs can produce stale or misleading reviewer output.

## Approval

Use `scripts/exhibit-ingest/approve-staging.mjs` to review approved staged creates before promotion. The script is dry-run by default and writes to `exhibit-records.json` only when called with `--apply`.
