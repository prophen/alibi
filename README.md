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

Docs in this repo: `SPEC.md` (the v0.1 spec), `BUILD-PLAN.md` (sequenced v0.1-v0.4 plan), `BUILD-SLICES.md` (coder-bot-ready build slices for v0.1).

## Status

Alibi is being built as a CLI for producing audit receipts for agent-produced code.

## Development

```sh
npm install
npm run build
npx alibi --help
```
