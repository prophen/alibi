#!/usr/bin/env node

import { IntakeError, parseIntake } from "./intake/index.js";
import { ProvisionError, provision } from "./provision/index.js";

const usage = `Usage: alibi <command> [options]

Commands:
  audit   Validate a directory intake
  provision  Provision a directory in a Solari sandbox

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

if (args[0] !== "audit" && args[0] !== "provision") {
  process.stderr.write(`Error: unknown command: ${args[0]}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
 try {
  const intake = parseIntake(args.slice(1));
  if (args[0] === "provision") {
    const provisioned = await provision(intake);
    process.stdout.write(`${JSON.stringify({
      sandboxId: provisioned.sandbox.id,
      guestRoot: provisioned.guestRoot,
      expiresAt: provisioned.sandbox.expiresAt,
    }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(intake, null, 2)}\n`);
 } catch (error) {
  if (error instanceof IntakeError || error instanceof ProvisionError) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
}

void main();
