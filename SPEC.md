# Alibi — Spec (draft v0.1)

**Alibi.** One line: *your coding agents ship code they can't vouch for — every run gets an alibi.*

## Problem

AI coding agents write real code that touches real files, and human review doesn't scale to every agent run. A diff shows what code *says*; it doesn't show what the code *does* — phoning home, writing outside the project dir, spawning unexpected processes, reading credentials. Nikema runs six Hermes agents including a coder bot; she is the reviewer, and reading every diff closely enough to catch behavior-level surprises isn't sustainable.

## What it does

A CLI. You hand it a directory of agent-produced code — a project, a script, whatever the agent made — plus a declaration of what it's supposed to do. It runs the code in a throwaway Solari sandbox with an audit hook attached, records the behavior the sandbox exposes, and produces an **alibi**: a markdown + JSON report of observed behavior plus a verdict. (Patch-file intake lands in v0.2.)

```
npx alibi audit --dir ./agent-output \
  --entry "node migrate.mjs --dry-run" \
  --project-root ./agent-output \
  --intent "Backfill user avatars from Gravatar, dry run only, no writes"
```

Output: `alibi.md` + `alibi.json` — the run's alibi.

## Intake

**Decision (2026-09-13): directories first, patches in v0.2.**

- **v0.1 — directory intake.** `alibi audit --dir ./agent-output --entry "..."` ships the whole directory to the sandbox and runs the entrypoint. One mechanism, no git dependency, no base to manage. A single script is just a directory with one file, so this covers both cases.
- **v0.2 — patch intake.** `alibi audit --patch agent-changes.diff --base ./project@main --entry "npm test"` applies the diff onto a trusted base inside the sandbox, then reuses the directory runner. This is the PR-review / CI story: audit exactly what changed against a base you trust. Deferred because it needs base management and patch-application failure handling — more ways for v0.1 to stumble.

## Pipeline

1. **Intake** (see above). Required: `--entry` (the command to run) and `--project-root` (the directory code is allowed to touch). Optional: `--intent` — free text of what the agent *claimed* the code does.
2. **Provision.** Boot a Solari sandbox from a clean snapshot (~1s boot), copy the code in. One `slr_live_` API key; everything bills to the same balance.
3. **Execute.** Run the declared entrypoint with the audit hook attached. Commands are not shell-interpreted — argv goes in `args` or the entry runs under `sh -c` explicitly (cookbook gotcha).
4. **Capture.** The audit hook records: files read/written (paths), outbound network connections (destinations), processes spawned, environment variables and sensitive paths accessed.
5. **Report.** Render the alibi and compute a verdict against the policy.
6. **Teardown.** `kill()` the VM, not `close()` — `close()` only drops the control channel and the VM keeps running until idle timeout (cookbook gotcha). `timeoutMs` is a rolling idle window, not a hard deadline.

## Report format

```markdown
# Alibi — migrate.mjs
Verdict: FLAG (2 findings)

## What it claimed
Backfill user avatars from Gravatar, dry run only, no writes

## What it did
- Files written: 0
- Files read: 14 (all under ./agent-output)
- Network: 1 — https://www.gravatar.com/avatar/... (allowlisted)
- Processes: node, node (child)

## Findings
- FLAG: read .env.example at project root (declared "no writes" but reads are fine — informational)
- FLAG: spawned a child node process not in the declared entrypoint

## Raw event log
[JSON appendix]
```

## Default policy (v0.1)

- **FLAG:** any write outside `--project-root`; any outbound network connection (allowed but flagged — allow-but-flag, not blocked); reads of `~/.ssh`, `~/.aws`, `*.pem`, `.env*`; any process spawn beyond the declared entrypoint's expected toolchain.
- **FAIL:** reserved for v0.2 configurable denylist (known-bad destinations, destructive commands like `rm -rf /`).
- **PASS:** everything else.
- Policy is hardcoded in v0.1, moves to a config file in v0.2.
- **Network decision (2026-09-13):** v0.1 uses allow-but-flag — network calls go through and are listed in the receipt for review. Rationale: the threat model is her own agents doing something unexpected, not malware; visibility without friction matters more at this stage. v0.2 adds `--strict` mode: deny-by-default with an allowlist, for auditing code from unfamiliar sources where prevention matters.

## Honest limits (say these in the README)

- This is not a malware-analysis sandbox. It will not catch exfiltration smuggled over an allowlisted channel, timing attacks, or logic bombs that only trigger later.
- The audit hook sees what the sandbox exposes; the README must document exactly which event classes are captured and which aren't.
- Verdicts are heuristics to focus human review, not proofs of safety. A PASS means "nothing suspicious observed," not "trusted."

## Tech

- TypeScript (Nikema's stack), Solari TS SDK.
- CLI first. No web UI in v0.1 — the receipt files *are* the interface.
- MIT license, public repo (needed if this doubles as the internship-style "publish it" artifact).

## Milestones

- **v0.1** — directory intake, hardcoded policy, md+JSON receipt. Prove the audit hook captures what we need.
- **v0.2** — patch/diff intake, policy config file, FAIL tier, `--strict` network mode (deny-by-default with allowlist).
- **v0.3** — intent-vs-behavior check: compare the agent's `--intent` claim against observed behavior and flag contradictions explicitly.
- **v0.4** — dogfood on real Hermes coder-bot output, publish the repo, Field Notes writeup ("My agents need an alibi").

## Open questions for Nikema

1. ~~Name~~ — decided 2026-09-13: **Alibi**. (`alibi` is taken on npm, so publish scoped, e.g. `@nikema/alibi`.)
2. Intake priority: ~~patch files or whole directories first~~ — decided 2026-09-13: directories in v0.1, patches in v0.2 (patch intake reuses the directory runner).
3. ~~Network default~~ — decided 2026-09-13: allow-but-flag in v0.1, `--strict` deny-by-default in v0.2.
