# prompt-provenance-diff-action

[![CI](https://github.com/mizcausevic-dev/prompt-provenance-diff-action/actions/workflows/ci.yml/badge.svg)](https://github.com/mizcausevic-dev/prompt-provenance-diff-action/actions/workflows/ci.yml)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](LICENSE)

GitHub Action that **gates PRs touching a prompt-provenance document**. Retrieves the previous version via `git show <base.sha>:<doc-path>`, diffs against HEAD via [`prompt-provenance-diff`](https://github.com/mizcausevic-dev/prompt-provenance-diff), posts the structured diff as a PR comment, and **fails the build on breaking changes** (hash rewritten, approval regressed, lineage parent changed, out-of-scope expanded).

**Third in the per-protocol diff Action quintet** (agent-card / mcp-tool-card / prompt-provenance / evidence-bundle / otel-genai).

Part of the [Kinetic Gain Suite](https://suite.kineticgain.com/).

---

## Usage

```yaml
name: Prompt Provenance gate
on:
  pull_request:
    paths: ["provenance/**/*.json"]

jobs:
  prompt-provenance-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # needed so the Action can `git show base.sha:path`
      - uses: mizcausevic-dev/prompt-provenance-diff-action@v0.1-shipped
        with:
          doc-path: provenance/my-prompt.json
          fail-on-breaking: true
```

> **Important:** Your `checkout` step must use `fetch-depth: 0` so the Action can resolve the base SHA. Otherwise the previous version retrieval returns null and the diff is reported as "new doc".

## Inputs

| input               | required | default       | description |
|---|---|---|---|
| `doc-path`          | ✓        | —             | Path (relative to repo root) to the prompt-provenance JSON document. |
| `base-sha`          |          | `pull_request.base.sha` | Override the base SHA. |
| `comment-on-pr`     |          | `auto`        | `auto` posts only on `pull_request` events. |
| `fail-on-breaking`  |          | `true`        | Fail when the diff is BREAKING. |
| `fail-on-any-change`|          | `false`       | Fail on ANY diff (frozen-doc workflow). |
| `github-token`      |          | `${{ github.token }}` | Token used to post the PR comment. |

## Outputs

| output         | description |
|---|---|
| `breaking`     | `true` iff the diff is BREAKING. |
| `change-count` | Number of changes detected. |
| `new-doc`      | `true` iff the file didn't exist at base SHA (newly added document). |

## What it detects

Same change reasons as [`prompt-provenance-diff`](https://github.com/mizcausevic-dev/prompt-provenance-diff) — breaking reasons include `prompt-hash-changed`, `approval-state-regressed`, `prompt-id-changed`, `provenance-version-changed`, `lineage-parent-changed`, and `intent-out-of-scope-changed`.

## How it handles edge cases

- **New doc** (file didn't exist at base SHA) → no diff, exits 0, sets `new-doc=true`.
- **Malformed previous version** → warns and treats as new doc.
- **doc-path doesn't exist on disk** → exits 1 with a clear error.
- **Non-PR context** (push, manual dispatch) → skips PR comment; still emits diff to logs.

## Composes with

- [**`prompt-provenance-diff`**](https://github.com/mizcausevic-dev/prompt-provenance-diff) — the library this wraps.
- [**`prompt-provenance-fleet-summary-action`**](https://github.com/mizcausevic-dev/prompt-provenance-fleet-summary-action) — fleet-level companion.
- [**`prompt-provenance-stamp`**](https://github.com/mizcausevic-dev/prompt-provenance-stamp) · [**`prompt-provenance-readme-generator`**](https://github.com/mizcausevic-dev/prompt-provenance-readme-generator) · [**`prompt-provenance-graph`**](https://github.com/mizcausevic-dev/prompt-provenance-graph) — full prompt-provenance family.
- Sibling diff actions: [**`agent-card-diff-action`**](https://github.com/mizcausevic-dev/agent-card-diff-action) · [**`mcp-tool-card-diff-action`**](https://github.com/mizcausevic-dev/mcp-tool-card-diff-action) · evidence-bundle-diff-action · otel-genai-diff-action (forthcoming).

## License

[AGPL-3.0-or-later](LICENSE)
