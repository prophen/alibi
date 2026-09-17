import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createReport, renderMarkdown } from "../dist/report/index.js";

const cases = ["clean", "network-only", "naughty"];
const verdicts = { clean: "PASS", "network-only": "FLAG", naughty: "FLAG" };

for (const name of cases) {
  test(`renders the ${name} golden report`, async () => {
    const root = new URL(`../fixtures/report/${name}/`, import.meta.url);
    const input = JSON.parse(await readFile(new URL("events.json", root), "utf8"));
    const report = createReport(input);
    const expectedJson = await readFile(new URL("expected/alibi.json", root), "utf8");
    const expectedMarkdown = await readFile(new URL("expected/alibi.md", root), "utf8");

    assert.equal(report.verdict, verdicts[name]);
    assert.equal(`${JSON.stringify(report, null, 2)}\n`, expectedJson);
    assert.equal(renderMarkdown(report), expectedMarkdown);
  });
}
