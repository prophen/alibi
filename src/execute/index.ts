import type { CommandResult } from "@solarisdk/sandbox";
import type { ProvisionedSandbox } from "../provision/index.js";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class ExecuteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecuteError";
  }
}

/**
 * Run the declared entry under an explicit shell. Solari does not interpret
 * command strings, so using `sh -c` preserves the CLI's command-line contract
 * without passing a shell string as the SDK command itself.
 */
export async function execute(
  provisioned: ProvisionedSandbox,
  entry: string,
  options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<ExecutionResult> {
  let result: CommandResult;
  try {
    result = await provisioned.sandbox.commands.run("sh", {
      args: ["-c", entry],
      cwd: options.cwd ?? provisioned.guestRoot,
      env: options.env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ExecuteError(`failed to execute entrypoint: ${message}`);
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}
