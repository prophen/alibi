# Alibi — Sequenced Build Plan

Derived from `SPEC.md` (draft v0.1, 2026-09-13). Written 2026-09-15, after Monday's interview.
One line: *your coding agents ship code they can't vouch for — every run gets an alibi.*

## Where we are

The spec is settled and three decisions are already locked: the name is **Alibi**, v0.1 takes **whole directories** (patch intake waits for v0.2), and v0.1 network policy is **allow-but-flag** (calls go through, everything is listed in the receipt; deny-by-default `--strict` waits for v0.2). TypeScript, CLI first, no web UI. This plan turns those commitments into build order.

## Pipeline modules — what each one owns

1. **Intake.** Takes `--dir`, `--entry`, `--project-root`, and optional `--intent`. Validates the entrypoint exists and the project root is inside the directory. One mechanism, no git dependency.
2. **Provision.** Boots a clean Solari sandbox from snapshot, copies the code in. Holds the single `slr_live_` key; everything bills to one balance.
3. **Execute.** Runs the declared entrypoint with the audit hook attached. Commands are not shell-interpreted: argv goes in `args`, or the entry runs explicitly under `sh -c`.
4. **Capture.** The audit hook records files read/written (paths), outbound network connections (destinations), processes spawned, and environment variables / sensitive paths accessed. This is the module with the most build-it-yourself work (see sandbox check).
5. **Report.** Renders `alibi.md` + `alibi.json` and computes the verdict against the policy: FLAG for writes outside project root, any outbound network, reads of `~/.ssh` / `~/.aws` / `*.pem` / `.env*`, and process spawns beyond the expected toolchain; PASS for everything else. FAIL tier is reserved for v0.2.
6. **Teardown.** `kill()` the VM, not `close()` — `close()` only drops the control channel and the VM keeps running until idle timeout. `timeoutMs` is a rolling idle window, not a hard deadline.

## Sandbox check — September 2026

Checked five current options against the spec's Solari choice. Bottom line up front: **Solari stays the default**, with one gap to close.

- **Solari (spec's choice).** MicroVM isolation, ~1s boot from snapshot, TypeScript SDK matching your stack, shell + filesystem + git built in. The spec's cookbook gotchas check out against current SDK docs (`kill()` vs `close()`, argv in `args`, rolling `timeoutMs`). Two caveats: no first-party event stream for files/network/processes could be verified, so the audit hook gets built in-sandbox (wrapper + filesystem diffing); and **pricing is unpublished** — confirm sandbox rates in the Solari console before committing to it.
- **Cloudflare Sandboxes (strongest alternative for this use case).** GA since April 2026. Real-time filesystem watching is a first-class API, and all outbound network passes through a programmable egress proxy you write — the closest thing to native capture hooks of any option. Active-CPU-only billing ($0.072/vCPU-hr) fits short audit runs. Weaker isolation (containers, shared kernel) than microVMs.
- **E2B.** Firecracker microVMs (strongest isolation), sub-second cold start, $0.0504/vCPU-hr. Same build-it-yourself story for the audit hook. Price leader with the biggest ecosystem.
- **Daytona.** Container-based, ~90ms provisioning, $0.0504/vCPU-hr, open-source and self-hostable. No dedicated behavior-audit API.
- **Modal.** `modal.Sandbox.create()`, gVisor isolation, priciest compute of the set (~$0.0710/vCPU-hr equivalent). No verified syscall/network event stream.

**No provider ships a ready-made "observed file activity, network calls, processes spawned" audit stream.** Every option requires building the capture layer. That is the core build risk of the whole project, and it lives in Phase 1.

## Sequenced phases

### Phase 1 — v0.1: prove the audit hook (the whole bet)

- **Entry:** Solari key in hand — Nikema redeemed the hiring-post code on 2026-09-15: starter tier, first month free, $20 credit (subscription will bill after the free month; cancel if not needed ongoing). SDK surface and current pricing confirmed in the console. One real agent-produced script to audit.
- **Work:** Intake CLI (`--dir`, `--entry`, `--project-root`, `--intent`), provision, execute, the capture shim, report rendering (`alibi.md` + `alibi.json`) with the hardcoded FLAG/PASS policy, teardown.
- **Exit:** A real script runs end to end and produces a receipt that correctly lists observed file activity, network destinations, and processes spawned. The honest-limits section is written in the README first, not last.
- **Checkpoint — your review:** read one full alibi for a script you already know the behavior of. If the receipt misses something you know happened, the capture layer isn't done. Nothing moves to v0.2 until the hook earns your trust.

### Phase 2 — v0.2: the PR-review story

- **Entry:** Phase 1 checkpoint signed off.
- **Work:** Patch intake (`--patch` applied onto a trusted `--base` inside the sandbox, reusing the directory runner), policy moves from hardcoded to a config file, FAIL tier (known-bad destinations, destructive commands), `--strict` network mode (deny-by-default with allowlist).
- **Exit:** A diff against a base audits cleanly; `--strict` blocks and reports a disallowed destination.
- **Checkpoint — your review:** approve the default policy config and the `--strict` allowlist format before they harden. Policy is a judgment call, not just code.

### Phase 3 — v0.3: intent vs. behavior

- **Entry:** Phase 2 checkpoint signed off.
- **Work:** Compare the agent's `--intent` claim against observed behavior and flag contradictions explicitly (e.g. claimed "no writes" but wrote files, claimed "Gravatar only" but called elsewhere).
- **Exit:** A deliberately misleading intent produces a contradiction finding in the report.
- **Checkpoint — your review:** decide how loud contradiction findings should be — FLAG or FAIL? This is the closest the tool gets to calling your agent a liar, so the tone is yours to set.

### Phase 4 — v0.4: dogfood and publish

- **Entry:** Phase 3 checkpoint signed off.
- **Work:** Run Alibi on real Hermes coder-bot output, fix what the dogfooding surfaces, publish the repo (MIT), write the Field Notes piece ("My agents need an alibi").
- **Exit:** Public repo, real audit receipts from your own agents, published writeup.
- **Checkpoint — your review:** the writeup goes out under your name, so you read it before it publishes. Same rule as everything else.

## Open questions (from the spec, verbatim)

All three were decided on 2026-09-13 and are carried here unchanged. Reopen any of them if you want — they're yours to revisit.

1. ~~Name~~ — decided 2026-09-13: **Alibi**. (`alibi` is taken on npm, so publish scoped, e.g. `@nikema/alibi`.)
2. Intake priority: ~~patch files or whole directories first~~ — decided 2026-09-13: directories in v0.1, patches in v0.2 (patch intake reuses the directory runner).
3. ~~Network default~~ — decided 2026-09-13: allow-but-flag in v0.1, `--strict` deny-by-default in v0.2.

## Honest limits (carried forward into the README)

- Not a malware-analysis sandbox. It won't catch exfiltration over an allowlisted channel, timing attacks, or logic bombs that trigger later.
- The audit hook sees what the sandbox exposes; the README documents exactly which event classes are captured and which aren't.
- Verdicts are heuristics to focus human review, not proofs of safety. PASS means "nothing suspicious observed," not "trusted."
