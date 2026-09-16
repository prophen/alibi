import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { Sandbox, SandboxClient } from "@solarisdk/sandbox";
import type { Intake } from "../intake/index.js";

const DEFAULT_BASE_URL = "https://api.getsolari.com";
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const GUEST_ROOT = "/workspace";

export interface ProvisionOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface ProvisionedSandbox {
  sandbox: Sandbox;
  guestRoot: string;
}

export class ProvisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvisionError";
  }
}

async function uploadDirectory(
  sandbox: Sandbox,
  localRoot: string,
  guestRoot: string,
): Promise<void> {
  const entries = await readdir(localRoot, { withFileTypes: true });
  for (const entry of entries) {
    const localPath = join(localRoot, entry.name);
    const guestPath = `${guestRoot}/${relative(localRoot, localPath)}`;
    if (entry.isDirectory()) {
      await sandbox.files.mkdir(guestPath);
      await uploadDirectory(sandbox, localPath, guestPath);
    } else if (entry.isFile()) {
      await sandbox.files.upload(guestPath, await readFile(localPath));
    } else if (entry.isSymbolicLink()) {
      throw new ProvisionError(`unsupported symbolic link in --dir: ${localPath}`);
    }
  }
}

export async function provision(
  intake: Intake,
  options: ProvisionOptions = {},
): Promise<ProvisionedSandbox> {
  const apiKey = options.apiKey ?? process.env.SOLARI_API_KEY;
  if (!apiKey) {
    throw new ProvisionError("SOLARI_API_KEY is required");
  }

  const client = new SandboxClient({
    apiKey,
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
  });
  const sandbox = await client.create({
    template: "base",
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    lifecycle: { onTimeout: "kill" },
  });

  try {
    await sandbox.connect();
    await sandbox.files.mkdir(GUEST_ROOT);
    await uploadDirectory(sandbox, intake.dir, GUEST_ROOT);
    return { sandbox, guestRoot: GUEST_ROOT };
  } catch (error) {
    await sandbox.kill().catch(() => undefined);
    throw error;
  }
}
