# Alibi

## Honest limits

- Not a malware-analysis sandbox. It won't catch exfiltration over an allowlisted channel, timing attacks, or logic bombs that trigger later.
- The audit hook sees what the sandbox exposes; the README documents exactly which event classes are captured and which aren't.
- Verdicts are heuristics to focus human review, not proofs of safety. PASS means "nothing suspicious observed," not "trusted."

Your coding agents ship code they can't vouch for. Every run gets an alibi.

Alibi runs agent-written code in a throwaway Solari sandbox with an audit hook attached, then produces a behavior receipt (`alibi.md` + `alibi.json`) with a PASS/FLAG/FAIL verdict.

The Slice 3 executor runs `--entry` with Solari's `commands.run("sh", { args:
["-c", entry] })` API. This is explicit shell execution: Solari does not
interpret command strings itself, and the CLI keeps the declared command's
stdout, stderr, and exit code unchanged. A non-zero entrypoint exit is returned
by the CLI after the sandbox is cleaned up.

## Capture limits

Slice 4 captures four event classes for the entrypoint run:

- **File reads and writes:** the in-sandbox `cat` wrapper records paths passed
  to that reader. A before/after `find` snapshot of the project and `/tmp` also
  records newly created regular files.
- **Outbound network connections:** the in-sandbox `curl` wrapper records its
  URL and arguments.
- **Processes spawned:** the in-sandbox `sh` wrapper records child shell
  invocations.
- **Environment and sensitive-path access:** paths such as `.env`, `~/.ssh`,
  `~/.aws`, and `*.pem` are visible through the file-read events.

This is wrapper and filesystem-diff observation exposed by the sandbox, not a
native Solari event stream. It does not capture reads performed by programs
other than the wrapped `cat`, writes to existing files, environment-variable
lookups that never touch a file, direct network clients other than the wrapped
`curl`, DNS details, Unix-domain sockets, file deletions or metadata-only
changes, or activity after the entrypoint exits. The audit hook sees what the
sandbox exposes; it is not a complete system-call forensic recorder.

Docs in this repo: `SPEC.md` (the v0.1 spec), `BUILD-PLAN.md` (sequenced v0.1-v0.4 plan), `BUILD-SLICES.md` (coder-bot-ready build slices for v0.1).

## Status

Alibi is being built as a CLI for producing audit receipts for agent-produced code.

## Development

```sh
npm install
npm run build
npx alibi --help
```
