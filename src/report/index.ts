import { writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { CaptureEvent } from "../capture/index.js";

export type Verdict = "PASS" | "FLAG";

export interface ReportInput {
  entry: string;
  intent?: string;
  projectRoot: string;
  events: CaptureEvent[];
  exitCode: number;
}

export interface Finding {
  reason: string;
  event: CaptureEvent;
}

export interface AlibiReport {
  entry: string;
  verdict: Verdict;
  findings: Finding[];
  counts: {
    filesRead: number;
    filesWritten: number;
    network: number;
    processes: number;
  };
  events: CaptureEvent[];
  exitCode: number;
  intent?: string;
}

function isSensitiveRead(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return (
    normalized.includes("/.ssh/") ||
    normalized.endsWith("/.ssh") ||
    normalized.includes("/.aws/") ||
    normalized.endsWith("/.aws") ||
    normalized.endsWith(".pem") ||
    /(^|\/)\.env(?:\..*)?$/.test(normalized)
  );
}

function isOutsideProjectRoot(path: string, projectRoot: string): boolean {
  const absolutePath = isAbsolute(path) ? resolve(path) : resolve(projectRoot, path);
  const relativePath = relative(resolve(projectRoot), absolutePath);
  return relativePath.startsWith("..") || isAbsolute(relativePath);
}

function findingFor(
  event: CaptureEvent,
  projectRoot: string,
  entry: string,
): Finding | undefined {
  if (event.class === "file-write" && isOutsideProjectRoot(event.detail, projectRoot)) {
    return { reason: "write outside project root", event };
  }
  if (event.class === "network") {
    return { reason: "outbound network connection", event };
  }
  if (event.class === "file-read" && isSensitiveRead(event.detail)) {
    return { reason: "sensitive path read", event };
  }
  if (event.class === "process" && !entry.includes(event.detail)) {
    return { reason: "process spawned beyond the declared entrypoint toolchain", event };
  }
  return undefined;
}

export function createReport(input: ReportInput): AlibiReport {
  const findings = input.events
    .map((event) => findingFor(event, input.projectRoot, input.entry))
    .filter((finding): finding is Finding => finding !== undefined);
  const count = (eventClass: CaptureEvent["class"]): number =>
    input.events.filter((event) => event.class === eventClass).length;

  return {
    entry: input.entry,
    verdict: findings.length > 0 ? "FLAG" : "PASS",
    findings,
    counts: {
      filesRead: count("file-read"),
      filesWritten: count("file-write"),
      network: count("network"),
      processes: count("process"),
    },
    events: input.events,
    exitCode: input.exitCode,
    ...(input.intent === undefined ? {} : { intent: input.intent }),
  };
}

function formatList(events: CaptureEvent[], eventClass: CaptureEvent["class"]): string {
  const details = events
    .filter((event) => event.class === eventClass)
    .map((event) => event.detail);
  return details.length === 0 ? "none" : details.join(", ");
}

export function renderMarkdown(report: AlibiReport): string {
  const findingCount = report.findings.length;
  return [
    `# Alibi — ${report.entry}`,
    `Verdict: ${report.verdict}${findingCount > 0 ? ` (${findingCount} findings)` : ""}`,
    "",
    "## What it claimed",
    report.intent ?? "(no intent provided)",
    "",
    "## What it did",
    `- Files written: ${report.counts.filesWritten} — ${formatList(report.events, "file-write")}`,
    `- Files read: ${report.counts.filesRead} — ${formatList(report.events, "file-read")}`,
    `- Network: ${report.counts.network} — ${formatList(report.events, "network")}`,
    `- Processes: ${report.counts.processes} — ${formatList(report.events, "process")}`,
    "",
    "## Findings",
    ...(findingCount === 0
      ? ["- None"]
      : report.findings.map(
          (finding) => `- FLAG: ${finding.reason} — ${finding.event.detail}`,
        )),
    "",
    "## Raw event log",
    "```json",
    JSON.stringify(report.events, null, 2),
    "```",
    "",
  ].join("\n");
}

export async function writeReport(
  report: AlibiReport,
  outputDirectory = process.cwd(),
): Promise<void> {
  await writeFile(resolve(outputDirectory, "alibi.md"), renderMarkdown(report), "utf8");
  await writeFile(
    resolve(outputDirectory, "alibi.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
}
