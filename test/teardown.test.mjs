import assert from "node:assert/strict";
import test from "node:test";
import { teardown } from "../dist/teardown/index.js";

test("teardown kills the sandbox instead of closing its control channel", async () => {
  let killed = 0;
  let closed = 0;
  const sandbox = {
    id: "sandbox-test",
    async kill() {
      killed += 1;
    },
    async close() {
      closed += 1;
    },
  };

  await teardown({ sandbox, guestRoot: "/workspace" });

  assert.equal(killed, 1);
  assert.equal(closed, 0);
});

test("teardown reports kill failures", async () => {
  await assert.rejects(
    teardown({
      sandbox: {
        id: "sandbox-test",
        async kill() {
          throw new Error("request failed");
        },
      },
      guestRoot: "/workspace",
    }),
    /failed to kill sandbox sandbox-test: request failed/,
  );
});
