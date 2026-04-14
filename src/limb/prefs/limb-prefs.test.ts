import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

const PREFS_PATH = resolve(__dirname, "../../../prefs/limb/limb.yaml");

interface PrefEntry {
  name: string;
  value: string | number | boolean;
}

describe("limb preferences YAML", () => {
  let prefs: PrefEntry[];

  it("parses as valid YAML", () => {
    const raw = readFileSync(PREFS_PATH, "utf-8");
    prefs = parse(raw);
    expect(Array.isArray(prefs)).toBe(true);
  });

  it("defines limb.home.url as string defaulting to about:blank", () => {
    const raw = readFileSync(PREFS_PATH, "utf-8");
    prefs = parse(raw);
    const pref = prefs.find((p) => p.name === "limb.home.url");
    expect(pref).toBeDefined();
    expect(typeof pref!.value).toBe("string");
    expect(pref!.value).toBe("about:blank");
  });

  it("defines limb.tree.max-live-tabs as int defaulting to 8", () => {
    const raw = readFileSync(PREFS_PATH, "utf-8");
    prefs = parse(raw);
    const pref = prefs.find((p) => p.name === "limb.tree.max-live-tabs");
    expect(pref).toBeDefined();
    expect(typeof pref!.value).toBe("number");
    expect(Number.isInteger(pref!.value)).toBe(true);
    expect(pref!.value).toBe(8);
  });

  it("defines limb.screenshots.retention-days as int defaulting to 7", () => {
    const raw = readFileSync(PREFS_PATH, "utf-8");
    prefs = parse(raw);
    const pref = prefs.find(
      (p) => p.name === "limb.screenshots.retention-days",
    );
    expect(pref).toBeDefined();
    expect(typeof pref!.value).toBe("number");
    expect(Number.isInteger(pref!.value)).toBe(true);
    expect(pref!.value).toBe(7);
  });

  it("uses only the limb.* preference branch", () => {
    const raw = readFileSync(PREFS_PATH, "utf-8");
    prefs = parse(raw);
    for (const pref of prefs) {
      expect(pref.name).toMatch(/^limb\./);
    }
  });
});
