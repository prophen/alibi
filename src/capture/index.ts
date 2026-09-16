import type { CommandResult } from "@solarisdk/sandbox";
import { join, relative } from "node:path";
import { Buffer } from "node:buffer";
import type { ProvisionedSandbox } from "../provision/index.js";

export type CaptureEventClass = "file-read" | "file-write" | "network" | "process";

export interface CaptureEvent {
  class: CaptureEventClass;
  detail: string;
}

export interface CaptureResult {
  command: CommandResult;
  events: CaptureEvent[];
}

export class CaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureError";
  }
}

const EVENTS_PATH = "/tmp/alibi-events";
const WRAPPER_DIR = "/tmp/alibi-bin";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function parseEvents(trace: string): CaptureEvent[] {
  const events: CaptureEvent[] = [];
  const seen = new Set<string>();
  const add = (event: CaptureEvent): void => {
    const key = `${event.class}:${event.detail}`;
    if (!seen.has(key)) {
      seen.add(key);
      events.push(event);
    }
  };

  for (const line of trace.split("\n")) {
    const [kind, detail] = line.split("\t", 2);
    if (kind === "read") {
      add({ class: "file-read", detail });
    } else if (kind === "network") {
      add({ class: "network", detail });
    } else if (kind === "process") {
      add({ class: "process", detail });
    }
  }

  return events;
}

async function snapshotFiles(
  provisioned: ProvisionedSandbox,
): Promise<Set<string>> {
  const result = await provisioned.sandbox.commands.run("find", {
    args: [provisioned.guestRoot, "/tmp", "-xdev", "-type", "f", "-print"],
  });
  if (result.exitCode !== 0) {
    throw new CaptureError(`failed to snapshot sandbox files: ${result.stderr.trim()}`);
  }
  return new Set(result.stdout.split("\n").map((path) => path.trim()).filter(Boolean));
}

async function readEvents(provisioned: ProvisionedSandbox): Promise<string> {
  const result = await provisioned.sandbox.commands.run("cat", {
    args: [EVENTS_PATH],
  });
  if (result.exitCode !== 0) {
    throw new CaptureError(`failed to read audit trace: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function wrapperSource(): string {
  return [
    "#!/bin/sh",
    "set -eu",
    'case "${0##*/}" in',
    '  cat) event=read ;;',
    '  curl) event=network ;;',
    '  sh) event=process ;;',
    '  *) exit 127 ;;',
    'esac',
    'printf "%s\\t%s\\n" "$event" "$*" >> /tmp/alibi-events',
    'case "$event" in',
    '  read) exec /bin/cat "$@" ;;',
    '  network) exec /usr/bin/curl "$@" ;;',
    '  process) exec /bin/sh "$@" ;;',
    'esac',
  ].join("\n");
}

export async function capture(
  provisioned: ProvisionedSandbox,
  entry: string,
  directory: string,
  projectRoot: string,
): Promise<CaptureResult> {
  const before = await snapshotFiles(provisioned);
  const projectRootInGuest = join(
    provisioned.guestRoot,
    relative(directory, projectRoot),
  );
  const wrapper = Buffer.from(wrapperSource()).toString("base64");
  const setup = `mkdir -p ${WRAPPER_DIR}; : > ${EVENTS_PATH}; printf '%s' ${shellQuote(wrapper)} | base64 -d > ${WRAPPER_DIR}/alibi-wrapper; chmod +x ${WRAPPER_DIR}/alibi-wrapper; ln -sf ${WRAPPER_DIR}/alibi-wrapper ${WRAPPER_DIR}/cat; ln -sf ${WRAPPER_DIR}/alibi-wrapper ${WRAPPER_DIR}/curl; ln -sf ${WRAPPER_DIR}/alibi-wrapper ${WRAPPER_DIR}/sh`;
  const command = `${setup}; PATH=${WRAPPER_DIR}:$PATH sh -c ${shellQuote(entry)}`;
  const result = await provisioned.sandbox.commands.run("sh", {
    args: ["-c", command],
    cwd: projectRootInGuest,
  });
  const after = await snapshotFiles(provisioned);
  const events = parseEvents(await readEvents(provisioned));

  for (const path of after) {
    if (!before.has(path)) {
      events.push({ class: "file-write", detail: path });
    }
  }

  return { command: result, events };
}
