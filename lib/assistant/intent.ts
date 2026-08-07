/** Lightweight, free (no-AI) intent detection for the floating assistant. Maps a
 * user message to an optional one-tap action chip (navigate + optional prefill).
 * Keyword-based so it costs nothing and responds instantly; the AI still writes
 * the conversational reply separately. */

export type AssistantAction = {
  href: string; // locale-relative route for @/i18n/navigation
  labelKey: string; // i18n key under Assistant namespace
};

type Rule = { labelKey: string; href: string | ((msg: string) => string); ar: RegExp; en: RegExp };

const RULES: Rule[] = [
  // NB: \b word boundaries are ASCII-only in JS regex and break on Arabic text,
  // so Arabic patterns use plain substring alternation. English patterns keep \b
  // since ASCII boundaries work there. Order matters: the specific intents come
  // before the generic "write" so "خطة محتوى" routes to the plan, not Studio.
  {
    labelKey: "actIdeas",
    href: "/ideas",
    ar: /فكرة|أفكار|افكار|اقتراح|مواضيع|موضوع/,
    en: /\b(idea|ideas|brainstorm|topics?|suggest)\b/i,
  },
  {
    labelKey: "actPlan",
    href: "/plan",
    ar: /خطة|خطه|تخطيط/,
    en: /\b(plan|content plan|monthly)\b/i,
  },
  {
    labelKey: "actCalendar",
    href: "/calendar",
    ar: /جدول|جدولة|تقويم|انشر|نشر|موعد/,
    en: /\b(schedule|calendar|publish|when to post)\b/i,
  },
  {
    labelKey: "actDna",
    href: "/dna",
    ar: /بصمة|بصمتي|صوتي|صوت العلامة|هويتي|أسلوبي/,
    en: /\b(dna|voice|my voice|brand voice|tone)\b/i,
  },
  {
    labelKey: "actAnalytics",
    href: "/analytics",
    ar: /تحليل|تحليلات|إحصاء|احصائيات|أداء|نتائج/,
    en: /\b(analytics|stats|performance|metrics|insights?)\b/i,
  },
  {
    // Compose a post → open Studio with the message as the prompt (generic; last).
    labelKey: "actWrite",
    href: (msg) => `/studio?prompt=${encodeURIComponent(stripVerb(msg))}`,
    ar: /اكتب|أكتب|اكتبي|صياغة|صيغ|بوست|منشور|تغريدة|محتوى/,
    en: /\b(write|compose|draft|post|caption|tweet|content)\b/i,
  },
];

/** Remove a leading imperative verb so the Studio prompt reads as a topic. */
function stripVerb(msg: string): string {
  return msg
    .trim()
    .replace(/^(اكتب(ي)?|أكتب|صيغ|اعمل|سو|من فضلك|رجاء)\s+(لي\s+)?(بوست|منشور|تغريدة|محتوى)?\s*(عن|حول)?\s*/i, "")
    .replace(/^(write|compose|draft|make|please)\s+(me\s+)?(a\s+)?(post|caption|tweet|content)?\s*(about|on)?\s*/i, "")
    .trim()
    .slice(0, 300) || msg.trim().slice(0, 300);
}

/** Detect the best action for a message, or null if none applies. */
export function detectAction(message: string): AssistantAction | null {
  const msg = message.trim();
  if (msg.length < 3) return null;
  for (const rule of RULES) {
    if (rule.ar.test(msg) || rule.en.test(msg)) {
      return { href: typeof rule.href === "function" ? rule.href(msg) : rule.href, labelKey: rule.labelKey };
    }
  }
  return null;
}
