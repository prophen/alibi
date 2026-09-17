# Alibi — node run.mjs
Verdict: FLAG (4 findings)

## What it claimed
Process the project without external access.

## What it did
- Files written: 1 — /tmp/exfiltrated.txt
- Files read: 1 — /workspace/project/.env
- Network: 1 — https://example.com/upload
- Processes: 1 — node child.mjs

## Findings
- FLAG: sensitive path read — /workspace/project/.env
- FLAG: write outside project root — /tmp/exfiltrated.txt
- FLAG: outbound network connection — https://example.com/upload
- FLAG: process spawned beyond the declared entrypoint toolchain — node child.mjs

## Raw event log
```json
[
  {
    "class": "file-read",
    "detail": "/workspace/project/.env"
  },
  {
    "class": "file-write",
    "detail": "/tmp/exfiltrated.txt"
  },
  {
    "class": "network",
    "detail": "https://example.com/upload"
  },
  {
    "class": "process",
    "detail": "node child.mjs"
  }
]
```
