import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The translation files are load-bearing UI. next-intl does not fail a build
 * over a key that does not exist — it renders the key PATH to the user, so
 * `Media.needKey` appeared on screen instead of a sentence, in production, for
 * anyone whose workspace had no generation key configured. Nothing caught it
 * because nothing was looking.
 *
 * These tests read the same files the app loads and the same call sites the app
 * renders, so they fail here instead of in front of a customer.
 */
const root = path.resolve(process.cwd());
const load = (locale: string) =>
  JSON.parse(fs.readFileSync(path.join(root, "messages", `${locale}.json`), "utf8")) as Record<string, unknown>;

const ar = load("ar");
const en = load("en");

function flatten(obj: Record<string, unknown>, prefix = ""): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) for (const n of flatten(v as Record<string, unknown>, key)) out.add(n);
    else out.add(key);
  }
  return out;
}

/** Every .ts/.tsx file under app/ and components/. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

describe("translations", () => {
  it("has identical keys in both locales", () => {
    const a = flatten(ar);
    const e = flatten(en);
    const onlyAr = [...a].filter((k) => !e.has(k));
    const onlyEn = [...e].filter((k) => !a.has(k));
    expect(onlyAr, `in ar but not en: ${onlyAr.join(", ")}`).toEqual([]);
    expect(onlyEn, `in en but not ar: ${onlyEn.join(", ")}`).toEqual([]);
  });

  it("has no empty strings — a blank label is a silent hole in the UI", () => {
    const blanks: string[] = [];
    const walk = (o: Record<string, unknown>, p = "") => {
      for (const [k, v] of Object.entries(o)) {
        const key = p ? `${p}.${k}` : k;
        if (v && typeof v === "object") walk(v as Record<string, unknown>, key);
        else if (typeof v === "string" && !v.trim()) blanks.push(key);
      }
    };
    walk(ar);
    walk(en);
    expect(blanks, `empty: ${blanks.join(", ")}`).toEqual([]);
  });

  // The regression this file exists for.
  it("defines every key the app actually asks for", () => {
    const files = [...sourceFiles(path.join(root, "app")), ...sourceFiles(path.join(root, "components"))];
    const missing: string[] = [];

    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      const namespaces = [
        ...src.matchAll(/(?:useTranslations|getTranslations)\(\s*"([^"]+)"/g),
      ].map((m) => m[1]);
      if (!namespaces.length) continue;

      // Literal lookups only: t(`x${y}`) is dynamic and cannot be checked here.
      const keys = new Set([...src.matchAll(/\b(?:t|to)\(\s*"([^"{}$]+)"/g)].map((m) => m[1]));
      for (const key of keys) {
        const found = namespaces.some((ns) => {
          const dict = (ar as Record<string, Record<string, unknown>>)[ns];
          return dict && key in dict;
        });
        if (!found) missing.push(`${path.relative(root, file)} → ${namespaces.join("|")}.${key}`);
      }
    }
    expect(missing, `referenced but undefined:\n${missing.join("\n")}`).toEqual([]);
  });
});
