# Alibi — sh fetch-example.sh
Verdict: FLAG (1 findings)

## What it claimed
(no intent provided)

## What it did
- Files written: 1 — /workspace/page.html
- Files read: 0 — none
- Network: 1 — https://example.com
- Processes: 1 — fetch-example.sh

## Findings
- FLAG: outbound network connection — https://example.com

## Raw event log
```json
[
  {
    "class": "process",
    "detail": "fetch-example.sh"
  },
  {
    "class": "network",
    "detail": "https://example.com"
  },
  {
    "class": "file-write",
    "detail": "/workspace/page.html"
  }
]
```
