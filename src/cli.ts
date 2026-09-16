#!/usr/bin/env node

import { IntakeError, parseIntake } from "./intake";

const usage = `Usage: alibi <command> [options]

Commands:
  audit   Validate a directory intake

Options:
  --dir <path>            Directory to audit
  --entry <command>       Entrypoint to run
  --project-root <path>   Project root inside the directory
  --intent <text>         Optional description of the intended behavior
  -h, --help  Show this help message
`;

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  process.stdout.write(usage);
  process.exit(0);
}

if (args[0] !== "audit") {
  process.stderr.write(`Error: unknown command: ${args[0]}\n`);
  process.exit(1);
}

try {
  const intake = parseIntake(args.slice(1));
  process.stdout.write(`${JSON.stringify(intake, null, 2)}\n`);
} catch (error) {
  if (error instanceof IntakeError) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
