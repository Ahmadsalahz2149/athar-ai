import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Accessibility rules the code has to keep, not remember.
 *
 * Every one of these started as a real gap found by reading the source: labels
 * that looked like labels but were `<div>`s, selects with no name at all, two
 * icon controls that a screen reader announces as "times". None of them broke a
 * build or a test, and none of them are visible to someone who can see — which
 * is exactly why they survived.
 *
 * These scan the source rather than a rendered page, so they run without a
 * browser and catch a regression at the moment it is written.
 */

const ROOT = path.resolve(process.cwd());

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const FILES = [...sourceFiles(path.join(ROOT, "app")), ...sourceFiles(path.join(ROOT, "components"))];
const read = (f: string) => fs.readFileSync(f, "utf8");
const rel = (f: string) => path.relative(ROOT, f);

/** The opening tag of each control, so attributes on it can be inspected. */
function controls(src: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    // Walk to the end of the opening tag, ignoring > inside {...} expressions.
    let depth = 0;
    for (let i = m.index; i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) {
        out.push(src.slice(m.index, i + 1));
        break;
      }
    }
  }
  return out;
}

describe("form controls have an accessible name", () => {
  // A control inside a <label> is named by it implicitly; one with aria-label or
  // a placeholder names itself. A hidden file input is driven by a labelled
  // button and is not reachable on its own.
  const named = (tag: string) =>
    /aria-label|aria-labelledby|placeholder=/.test(tag) || /\btype="hidden"/.test(tag) || /\bhidden\b/.test(tag);

  it("every input, textarea and select is named", () => {
    const unnamed: string[] = [];
    for (const f of FILES) {
      const src = read(f);
      for (const tag of ["input", "textarea", "select"]) {
        for (const c of controls(src, tag)) {
          if (named(c)) continue;
          const before = src.slice(0, src.indexOf(c));
          // Inside a wrapping <label>? Look back for an unclosed one.
          const opens = (before.match(/<label\b/g) ?? []).length;
          const closes = (before.match(/<\/label>/g) ?? []).length;
          if (opens > closes) continue;
          // Or inside <Field>, which IS a wrapping <label> — in another file, so
          // no amount of scanning this one can see it. Trusting the component by
          // name is the honest limit of a source-level check, and the component
          // itself is one file to keep right.
          if (/<Field[\s>][^<]*$/.test(before.slice(-300))) continue;
          unnamed.push(`${rel(f)}: ${c.slice(0, 80)}`);
        }
      }
    }
    expect(unnamed).toEqual([]);
  });
});

describe("controls whose only content is an icon carry a name", () => {
  // "×" reads as "times" and "⬇" as nothing. A delete button nobody can
  // identify is a delete button somebody presses by accident.
  const ICON_ONLY = /<(button|a)\b[^>]*>\s*[×✕✖⬇↓⋯…⚙✎✕]\s*<\/(button|a)>/g;

  it("no icon-only button or link is anonymous", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      for (const m of read(f).matchAll(ICON_ONLY)) {
        if (!/aria-label|aria-labelledby|title=/.test(m[0])) bad.push(`${rel(f)}: ${m[0].slice(0, 70)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("right-to-left safety", () => {
  // The product is Arabic-first. A physical direction hard-codes the layout to
  // one side and silently mirrors wrong in the other language, which is the
  // kind of bug nobody notices until a customer does.
  it("uses logical properties, never left/right", () => {
    const physical = /\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeft|borderRight|textAlign:\s*"(left|right)")\b/;
    const offenders = FILES.filter((f) => physical.test(read(f))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe("images describe themselves", () => {
  it("every img has alt text", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      for (const c of controls(read(f), "img")) {
        if (!/\balt=/.test(c)) bad.push(`${rel(f)}: ${c.slice(0, 70)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("screens that wait for data say so", () => {
  // Without a loading.tsx, Next.js leaves the PREVIOUS page on screen while the
  // new one's query runs. To the person clicking, that is indistinguishable
  // from a click that did nothing.
  it("every data-backed app screen has a loading state", () => {
    const appDir = path.join(ROOT, "app/[locale]/(app)");
    const missing: string[] = [];
    for (const entry of fs.readdirSync(appDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(appDir, entry.name);
      const page = path.join(dir, "page.tsx");
      if (!fs.existsSync(page)) continue;
      const awaitsData = /await (currentContext|forOrg)|forOrg\(/.test(read(page));
      if (awaitsData && !fs.existsSync(path.join(dir, "loading.tsx"))) missing.push(entry.name);
    }
    expect(missing).toEqual([]);
  });
});
