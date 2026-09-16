#!/usr/bin/env node

const usage = `Usage: alibi <command> [options]

Commands:
  audit   Audit a directory and write an alibi receipt

Options:
  -h, --help  Show this help message
`;

process.stdout.write(usage);
