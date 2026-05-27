# Changelog

## v0.1.0 — 2026-05-27

- Initial release: GitHub Action wrapping `prompt-provenance-diff` as a per-PR prompt-provenance breaking-change gate.
- Inputs: `doc-path` (required), `base-sha` (default `pull_request.base.sha`), `comment-on-pr` (auto/true/false), `fail-on-breaking` (default true), `fail-on-any-change` (default false), `github-token`.
- Outputs: `breaking`, `change-count`, `new-doc`.
- Vendored `diffProvenance()` + `toMarkdown` from `prompt-provenance-diff`.
- Same diff-action template as `agent-card-diff-action` / `mcp-tool-card-diff-action`.
- Handles 3 edge cases: newly-added doc (no previous version), malformed previous version, missing doc-path on disk.
- Composite Node 20 action with `dist/index.js` committed for SHA/tag pinning.
- 14 tests with injected `gitShow` for hermetic execution.
- 4 fixtures inherited from `prompt-provenance-diff` (previous, next-nonbreaking, next-revoked, next-tuned).
- **Third in the per-protocol diff Action quintet** — follows `agent-card-diff-action` and `mcp-tool-card-diff-action`; next up: evidence-bundle-diff-action, otel-genai-diff-action.
- Node 20/22 CI (lint, typecheck, coverage, build, `npm audit`), AGPL-3.0-or-later, Dependabot.
