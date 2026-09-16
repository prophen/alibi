# Alibi — node fetch.mjs
Verdict: FLAG (1 findings)

## What it claimed
Fetch the public status page.

## What it did
- Files written: 0 — none
- Files read: 0 — none
- Network: 1 — https://example.com/status
- Processes: 0 — none

## Findings
- FLAG: outbound network connection — https://example.com/status

## Raw event log
```json
[
  {
    "class": "network",
    "detail": "https://example.com/status"
  }
]
```
