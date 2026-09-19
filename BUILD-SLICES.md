# Alibi — Coder-Bot Build Slices (v0.1)

Source of truth: `SPEC.md` (locked 2026-09-13) and `BUILD-PLAN.md` Phase 1. This doc covers **v0.1 only**: directory intake, hardcoded FLAG/PASS policy, `alibi.md` + `alibi.json` receipt. Phases 2 to 4 (patch intake, policy config, `--strict`, dogfooding, publish) are out of scope for these slices.

## Rules for whoever runs these slices (Codex, or Muse)

1. **One slice per run.** Do not start the next slice until Nikema has reviewed and approved the finished one.
2. **Stop rule on every slice:** when the slice's acceptance check passes, commit the work on a branch named `slice-N-<slug>`, push, open a pull request against `main` with the report as the PR description, and report: what was built, how the acceptance check passed, and anything you had to guess. Then wait. Do not merge, do not continue.
3. **Do not invent Solari SDK APIs.** Check the installed SDK version's actual exports and docs before writing provider calls. If an API you need doesn't exist, stop and say so instead of faking it.
4. **Secrets:** the Solari key comes from an env var (`SOLARI_API_KEY`). Never commit it, never log it, never write it to a file.
5. **Defaults:** TypeScript (strict), CLI first, no web UI. Package name `alibi` is taken on npm; publish scope is reserved for later (`@nikema/alibi`). For v0.1 the bin can just be `alibi` locally.
6. When a slice's acceptance check needs a fixture, create it under `fixtures/` and keep it checked in.

---

## Slice 0 — Repo scaffold

**Build:**
- `package.json` with a `bin` entry for `alibi`, TS devDependencies, scripts: `build`, `test`, `lint`.
- `tsconfig.json` (strict), MIT `LICENSE`.
- Directory layout: `src/intake/`, `src/provision/`, `src/execute/`, `src/capture/`, `src/report/`, `src/teardown/`, plus `fixtures/`.
- README skeleton. The honest-limits section (from the spec, verbatim) goes in **first**, before any feature documentation:
  - Not a malware-analysis sandbox. It won't catch exfiltration over an allowlisted channel, timing attacks, or logic bombs that trigger later.
  - The audit hook sees what the sandbox exposes; the README documents exactly which event classes are captured and which aren't.
  - Verdicts are heuristics to focus human review, not proofs of safety. PASS means "nothing suspicious observed," not "trusted."

**Acceptance check:** `npm run build` passes with no TS errors, and `npx alibi --help` prints usage and exits 0.

**Stop rule:** push branch `slice-0-scaffold`, open a PR against main with your report as the description, wait.

---

## Slice 1 — Intake CLI (no sandbox yet)

**Build:**
- Parse: `--dir` (required), `--entry` (required), `--project-root` (required), `--intent` (optional free text).
- Validate: `--dir` exists and is a directory; `--entry` is a non-empty string; `--project-root` resolves to a path **inside** `--dir`.
- Failure mode: clean one-line error message on stderr, non-zero exit. No stack traces for user errors.
- Export the validated intake as a typed object for later slices to consume.

**Acceptance check:** against `fixtures/sample-script/` (a dir containing one real script):
- valid args pass validation and print the parsed intake;
- `--project-root /etc` fails with a clear message;
- a missing `--dir` fails with a clear message.

**Stop rule:** push branch `slice-1-intake`, open a PR against main with your report as the description, wait.

---

## Slice 2 — Provision a clean sandbox

**Build:**
- Read `SOLARI_API_KEY` from env; fail with a clear message if unset.
- Boot a Solari sandbox from a clean snapshot, copy the validated `--dir` contents into the sandbox.
- Surface the sandbox handle to later slices. Set an idle timeout (note: Solari's `timeoutMs` is a rolling idle window, not a hard deadline).
- Entry requirement for Nikema before this slice starts: confirm current sandbox pricing in the Solari console (pricing is unpublished; she holds a starter tier with a $20 credit from a redeemed hiring-post code).

**Acceptance check:** provision from `fixtures/sample-script/`, then list the directory inside the sandbox and read back a canary file byte-for-byte identical to the local copy. Then tear down manually.

**Stop rule:** push branch `slice-2-provision`, open a PR against main with your report as the description, wait.

---

## Slice 3 — Execute the entrypoint

**Build:**
- Run the declared `--entry` inside the provisioned sandbox.
- Commands are **not** shell-interpreted: pass argv through the SDK's args form, or run the entry explicitly under `sh -c`. Document which you chose and why.
- Capture stdout, stderr, and exit code. A non-zero exit propagates as a non-zero CLI exit; the audit still continues to the report stage (a crashed script still gets an alibi).

**Acceptance check:** run `fixtures/sample-script/run.sh` (prints to stdout and stderr, exits 0) and `fixtures/sample-script/fail.sh` (exits 3): both outputs captured exactly, exit codes propagate.

**Stop rule:** push branch `slice-3-execute`, open a PR against main with your report as the description, wait.

---

## Slice 4 — Capture: the audit hook (the whole bet of v0.1)

**Build:**
- The hook records, for the entrypoint run: files read and written (paths), outbound network connections (destinations), processes spawned, and environment variables / sensitive paths accessed.
- No provider ships this as a native stream, so build it in-sandbox (wrapper around the entrypoint plus filesystem diffing). Document exactly which event classes are captured and which aren't, and mirror that in the README's limits section.

**Acceptance check (the one that matters):** `fixtures/naughty-script/` does all of these, and the capture layer must list every one:
- writes a file **outside** the project root,
- reads a fake `.env` at the project root,
- makes an outbound HTTPS request to a known URL,
- spawns a child process.

**Stop rule:** push branch `slice-4-capture`, open a PR against main with your report as the description, wait.

**Nikema's checkpoint (from the build plan):** she reads one full alibi for a script whose behavior she already knows. If the receipt misses something she knows happened, the capture layer is not done. Nothing moves past this slice until the hook earns her trust.

---

## Slice 5 — Report: alibi.md + alibi.json and the verdict

**Build:**
- Render the alibi in the spec's report format: `# Alibi — <entry>`, verdict line, "What it claimed" (the `--intent`), "What it did" (counts + lists), findings, raw event log appendix.
- Compute the verdict against the **hardcoded** v0.1 policy (config file is v0.2):
  - **FLAG:** any write outside `--project-root`; any outbound network connection (allowed but flagged, allow-but-flag); reads of `~/.ssh`, `~/.aws`, `*.pem`, `.env*`; any process spawn beyond the declared entrypoint's expected toolchain.
  - **PASS:** everything else.
  - **FAIL:** reserved for v0.2. Do not implement it.

**Acceptance check:** golden tests. Feed the slice three canned event logs (clean script, network-only script, naughty script) and assert the verdicts are PASS, FLAG, FLAG and that `alibi.md` and `alibi.json` match the expected files byte-for-byte.

**Stop rule:** push branch `slice-5-report`, open a PR against main with your report as the description, wait.

---

## Slice 6 — Teardown

**Build:**
- After the report is written, `kill()` the VM. Do **not** use `close()`: it only drops the control channel and the VM keeps running until idle timeout (SDK cookbook gotcha).
- Teardown runs even when the entrypoint crashed or the capture layer threw. A leaked sandbox is a bug.

**Acceptance check:** run an end-to-end audit of `fixtures/sample-script/`, then verify no sandbox VMs remain on the account afterwards (console or list API). Separately, verify a deliberately hanging entrypoint gets reclaimed by the idle timeout.

**Stop rule:** push branch `slice-6-teardown`, open a PR against main with your report as the description, wait.

---

## Slice 7 — End to end: one real alibi

**Build:**
- Wire intake, provision, execute, capture, report, teardown into `alibi audit`.
- Run it once against a real agent-produced script (Nikema supplies one; suggested first candidate: a small script her Hermes coder bot actually wrote).

**Acceptance check (the Phase 1 exit):** the run produces `alibi.md` + `alibi.json` that correctly list observed file activity, network destinations, and processes spawned for that script.

**Stop rule:** push branch `slice-7-e2e`, open a PR against main with your report as the description, wait.

**Nikema's final v0.1 checkpoint:** she reviews the full receipt for a script whose behavior she knows. Only her signoff closes v0.1.

---

## What comes after (not these slices)

- v0.2: `--patch` intake on a trusted `--base`, policy config file, FAIL tier, `--strict` deny-by-default network mode.
- v0.3: intent-vs-behavior contradiction findings.
- v0.4: dogfood on real Hermes coder-bot output, public repo (MIT), Field Notes writeup ("My agents need an alibi").

Slices for those phases get written after v0.1's checkpoint is signed off.
