import { describe, expect, it } from "vitest";
import plugin from "./copy.js";

const rule = plugin.rules["no-em-dash"];

const reportsFor = (type, node) => {
  const reports = [];
  const visitors = rule.create({
    report: (report) => reports.push(report),
  });
  visitors[type]({ type, ...node });
  return reports.length;
};

describe("copy/no-em-dash", () => {
  it("reports an em dash in a string literal", () => {
    expect(reportsFor("Literal", { value: "Analytics — Cadence" })).toBe(1);
  });

  it("reports an em dash in a template literal", () => {
    expect(
      reportsFor("TemplateElement", { value: { raw: " — Cadence" } })
    ).toBe(1);
  });

  it("reports an em dash in JSX text", () => {
    expect(reportsFor("JSXText", { value: "Ask here — they answer" })).toBe(1);
  });

  it("allows the pipe, the en dash and plain copy", () => {
    expect(reportsFor("Literal", { value: "Analytics | Cadence" })).toBe(0);
    expect(reportsFor("JSXText", { value: "–" })).toBe(0);
    expect(reportsFor("TemplateElement", { value: { raw: "a - b" } })).toBe(0);
  });

  it("ignores literals that are not strings", () => {
    expect(reportsFor("Literal", { value: 42 })).toBe(0);
  });
});
