import { join, relative } from "node:path";
import { Buffer } from "node:buffer";
import type { ProvisionedSandbox } from "../provision/index.js";
import type { ExecutionResult } from "../execute/index.js";

export type CaptureEventClass = "file-read" | "file-write" | "network" | "process";

export interface CaptureEvent {
  class: CaptureEventClass;
  detail: string;
}

export interface CaptureResult {
  command: ExecutionResult;
  events: CaptureEvent[];
}

export interface CaptureSession {
  before: Set<string>;
  cwd: string;
  env: Record<string, string>;
}

export class CaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureError";
  }
}

const EVENTS_PATH = "/tmp/alibi-events";
const WRAPPER_DIR = "/tmp/alibi-bin";

function isInstrumentationPath(path: string): boolean {
  return path === EVENTS_PATH || path.startsWith(`${WRAPPER_DIR}/`);
}

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
      const url = detail
        .split(/\s+/)
        .find((argument) => /^https?:\/\//.test(argument));
      add({ class: "network", detail: url ?? detail });
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
  return new Set(
    result.stdout
      .split("\n")
      .map((path) => path.trim())
      .filter((path) => path.length > 0 && !isInstrumentationPath(path)),
  );
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

export async function startCapture(
  provisioned: ProvisionedSandbox,
  directory: string,
  projectRoot: string,
): Promise<CaptureSession> {
  const before = await snapshotFiles(provisioned);
  const projectRootInGuest = join(
    provisioned.guestRoot,
    relative(directory, projectRoot),
  );
  const wrapper = Buffer.from(wrapperSource()).toString("base64");
  const setup = `mkdir -p ${WRAPPER_DIR}; : > ${EVENTS_PATH}; printf '%s' ${shellQuote(wrapper)} | base64 -d > ${WRAPPER_DIR}/alibi-wrapper; chmod +x ${WRAPPER_DIR}/alibi-wrapper; ln -sf ${WRAPPER_DIR}/alibi-wrapper ${WRAPPER_DIR}/cat; ln -sf ${WRAPPER_DIR}/alibi-wrapper ${WRAPPER_DIR}/curl; ln -sf ${WRAPPER_DIR}/alibi-wrapper ${WRAPPER_DIR}/sh`;
  const setupResult = await provisioned.sandbox.commands.run("sh", {
    args: ["-c", setup],
    cwd: projectRootInGuest,
  });
  if (setupResult.exitCode !== 0) {
    throw new CaptureError(`failed to install audit hook: ${setupResult.stderr.trim()}`);
  }

  return {
    before,
    cwd: projectRootInGuest,
    env: {
      PATH: `${WRAPPER_DIR}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
    },
  };
}

export async function finishCapture(
  provisioned: ProvisionedSandbox,
  session: CaptureSession,
  command: ExecutionResult,
): Promise<CaptureResult> {
  const after = await snapshotFiles(provisioned);
  const events = parseEvents(await readEvents(provisioned));

  for (const path of after) {
    if (!session.before.has(path)) {
      events.push({ class: "file-write", detail: path });
    }
  }

  return { command, events };
}

export async function capture(
  provisioned: ProvisionedSandbox,
  entry: string,
  directory: string,
  projectRoot: string,
): Promise<CaptureResult> {
  const session = await startCapture(provisioned, directory, projectRoot);
  const command = await provisioned.sandbox.commands.run("sh", {
    args: ["-c", entry],
    cwd: provisioned.guestRoot,
    env: session.env,
  });
  return finishCapture(provisioned, session, command);
}
