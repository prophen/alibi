# Alibi — node clean.mjs
Verdict: PASS

## What it claimed
Format the input data locally.

## What it did
- Files written: 1 — /workspace/project/output.json
- Files read: 1 — /workspace/project/input.json
- Network: 0 — none
- Processes: 0 — none

## Findings
- None

## Raw event log
```json
[
  {
    "class": "file-read",
    "detail": "/workspace/project/input.json"
  },
  {
    "class": "file-write",
    "detail": "/workspace/project/output.json"
  }
]
```
