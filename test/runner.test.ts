import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { run, type RunnerEnv } from "../src/runner.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const PREVIOUS = `${here}/../fixtures/previous.json`;
const NEXT_NONBREAKING = `${here}/../fixtures/next-nonbreaking.json`;
const NEXT_REVOKED = `${here}/../fixtures/next-revoked.json`;
const NEXT_TUNED = `${here}/../fixtures/next-tuned.json`;

const PREVIOUS_CONTENT = readFileSync(PREVIOUS, "utf8");
const NEXT_NONBREAKING_CONTENT = readFileSync(NEXT_NONBREAKING, "utf8");
const NEXT_REVOKED_CONTENT = readFileSync(NEXT_REVOKED, "utf8");
const NEXT_TUNED_CONTENT = readFileSync(NEXT_TUNED, "utf8");

void NEXT_TUNED_CONTENT;

function makeEnv(opts: {
  docPath?: string;
  docContent?: string;
  prevContent?: string | null;
  isPullRequest?: boolean;
  hasToken?: boolean;
  failOnBreaking?: string;
  failOnAnyChange?: string;
  baseSha?: string;
  omitBaseSha?: boolean;
}): RunnerEnv {
  const docPath = opts.docPath ?? "provenance/my-prompt.json";
  const docContent = opts.docContent ?? PREVIOUS_CONTENT;
  const prevContent = opts.prevContent;

  const inputs: Record<string, string | undefined> = {
    doc_path: docPath,
    comment_on_pr: "false"
  };
  if (opts.failOnBreaking !== undefined) inputs.fail_on_breaking = opts.failOnBreaking;
  if (opts.failOnAnyChange !== undefined) inputs.fail_on_any_change = opts.failOnAnyChange;
  if (opts.baseSha !== undefined) inputs.base_sha = opts.baseSha;
  else if (!opts.omitBaseSha && !opts.isPullRequest) inputs.base_sha = "abc123";
  if (opts.hasToken) inputs.github_token = "ghs_test";

  const env: RunnerEnv = {
    inputs,
    readFile: (p) => (p === docPath ? docContent : "{}"),
    exists: (p) => p === docPath,
    gitShow: () => prevContent ?? null,
    write: () => undefined
  };
  if (opts.isPullRequest) {
    env.GITHUB_EVENT_NAME = "pull_request";
    env.GITHUB_REPOSITORY = "x/y";
    env.GITHUB_EVENT_PATH = `${here}/event.json`;
    env.readFile = (p) => {
      if (p === docPath) return docContent;
      if (p.endsWith("event.json")) return JSON.stringify({ number: 42, pull_request: { number: 42, base: { sha: "abc123" } } });
      return "{}";
    };
    env.exists = (p) => p === docPath || p.endsWith("event.json");
  }
  return env;
}

describe("runner.run", () => {
  it("exits 1 when diff is breaking (revoked = approval-state-regressed) and fail-on-breaking is true (default)", async () => {
    const r = await run(makeEnv({ docContent: NEXT_REVOKED_CONTENT, prevContent: PREVIOUS_CONTENT }));
    expect(r.exitCode).toBe(1);
    expect(r.diff?.breaking).toBe(true);
    expect(r.newDoc).toBe(false);
  });

  it("exits 0 when diff is non-breaking", async () => {
    const r = await run(makeEnv({ docContent: NEXT_NONBREAKING_CONTENT, prevContent: PREVIOUS_CONTENT }));
    expect(r.exitCode).toBe(0);
    expect(r.diff?.breaking).toBe(false);
  });

  it("exits 0 when fail-on-breaking is false even on breaking diff", async () => {
    const r = await run(makeEnv({ docContent: NEXT_REVOKED_CONTENT, prevContent: PREVIOUS_CONTENT, failOnBreaking: "false" }));
    expect(r.exitCode).toBe(0);
  });

  it("exits 1 when fail-on-any-change is true and any change exists", async () => {
    const r = await run(makeEnv({ docContent: NEXT_NONBREAKING_CONTENT, prevContent: PREVIOUS_CONTENT, failOnAnyChange: "true", failOnBreaking: "false" }));
    expect(r.exitCode).toBe(1);
  });

  it("treats missing previous version as 'new doc' and exits 0", async () => {
    const r = await run(makeEnv({ docContent: PREVIOUS_CONTENT, prevContent: null, omitBaseSha: true }));
    expect(r.exitCode).toBe(0);
    expect(r.newDoc).toBe(true);
  });

  it("treats malformed previous version as 'new doc' (warns but continues)", async () => {
    const r = await run(makeEnv({ docContent: PREVIOUS_CONTENT, prevContent: "not-json", baseSha: "abc" }));
    expect(r.exitCode).toBe(0);
    expect(r.newDoc).toBe(true);
  });

  it("rejects when doc-path input is missing", async () => {
    await expect(run({ inputs: {} })).rejects.toThrow(/doc_path/);
  });

  it("exits 1 when doc-path doesn't exist on disk", async () => {
    const env: RunnerEnv = {
      inputs: { doc_path: "nonexistent.json", comment_on_pr: "false" },
      readFile: () => "{}",
      exists: () => false,
      write: () => undefined
    };
    const r = await run(env);
    expect(r.exitCode).toBe(1);
    expect(r.reason).toBe("doc-path not found");
  });

  it("posts a PR comment in pull_request context", async () => {
    const calls: Array<{ body: string }> = [];
    const env = makeEnv({ docContent: NEXT_REVOKED_CONTENT, prevContent: PREVIOUS_CONTENT, isPullRequest: true, hasToken: true, failOnBreaking: "false" });
    env.inputs.comment_on_pr = "auto";
    env.postComment = async (args) => { calls.push({ body: args.body }); };
    const r = await run(env);
    expect(r.commentPosted).toBe(true);
    expect(calls[0].body).toContain("Prompt Provenance diff");
  });

  it("uses base-sha input override when provided", async () => {
    let observedSha = "";
    const env = makeEnv({ docContent: PREVIOUS_CONTENT, prevContent: PREVIOUS_CONTENT, baseSha: "override-sha" });
    env.gitShow = (sha) => { observedSha = sha; return PREVIOUS_CONTENT; };
    await run(env);
    expect(observedSha).toBe("override-sha");
  });

  it("reads base.sha from pull_request event payload when no input override", async () => {
    let observedSha = "";
    const env = makeEnv({ docContent: PREVIOUS_CONTENT, prevContent: PREVIOUS_CONTENT, isPullRequest: true });
    env.gitShow = (sha) => { observedSha = sha; return PREVIOUS_CONTENT; };
    await run(env);
    expect(observedSha).toBe("abc123");
  });

  it("skips PR comment when token is missing", async () => {
    const env = makeEnv({ docContent: NEXT_NONBREAKING_CONTENT, prevContent: PREVIOUS_CONTENT, isPullRequest: true });
    env.inputs.comment_on_pr = "true";
    const r = await run(env);
    expect(r.commentPosted).toBe(false);
    expect(r.reason).toBe("no github-token provided");
  });

  it("skips PR comment when GITHUB_EVENT_PATH missing", async () => {
    const env: RunnerEnv = {
      inputs: { doc_path: "x.json", comment_on_pr: "true", github_token: "ghs", fail_on_breaking: "false" },
      GITHUB_REPOSITORY: "x/y",
      readFile: () => PREVIOUS_CONTENT,
      exists: (p) => p === "x.json",
      gitShow: () => PREVIOUS_CONTENT,
      write: () => undefined
    };
    const r = await run(env);
    expect(r.commentPosted).toBe(false);
    expect(r.reason).toBe("no GITHUB_EVENT_PATH");
  });

  it("does not comment on non-PR events with comment_on_pr=auto", async () => {
    const env: RunnerEnv = {
      inputs: { doc_path: "x.json", comment_on_pr: "auto", github_token: "ghs", fail_on_breaking: "false" },
      GITHUB_EVENT_NAME: "push",
      readFile: () => PREVIOUS_CONTENT,
      exists: (p) => p === "x.json",
      gitShow: () => PREVIOUS_CONTENT,
      write: () => undefined
    };
    const r = await run(env);
    expect(r.commentPosted).toBe(false);
  });
});
