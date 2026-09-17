import type { ProvisionedSandbox } from "../provision/index.js";

export class TeardownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeardownError";
  }
}

/**
 * Destroy the sandbox rather than merely closing its control connection.
 * `close()` leaves the VM alive until its configured idle timeout.
 */
export async function teardown(provisioned: ProvisionedSandbox): Promise<void> {
  try {
    await provisioned.sandbox.kill();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TeardownError(`failed to kill sandbox ${provisioned.sandbox.id}: ${message}`);
  }
}
