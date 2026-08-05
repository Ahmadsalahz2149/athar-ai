/** Curated world days & occasions (Phase 2 #7) — fixed Gregorian dates relevant
 * to a Gulf/Arab personal-brand and business audience. Lunar-date occasions
 * (Ramadan, Eid) shift yearly so they're intentionally omitted here; the monthly
 * AI plan surfaces seasonal moments instead. Each entry: month (1-12), day,
 * Arabic + English label, and a tag for tinting. */
export type WorldDay = { month: number; day: number; ar: string; en: string; tag: "intl" | "business" | "tech" | "social" | "gulf" };

export const WORLD_DAYS: WorldDay[] = [
  { month: 1, day: 1, ar: "رأس السنة الميلادية", en: "New Year's Day", tag: "social" },
  { month: 1, day: 4, ar: "اليوم العالمي لبريل", en: "World Braille Day", tag: "social" },
  { month: 1, day: 24, ar: "اليوم العالمي للتعليم", en: "International Day of Education", tag: "social" },
  { month: 2, day: 4, ar: "اليوم العالمي للسرطان", en: "World Cancer Day", tag: "social" },
  { month: 2, day: 11, ar: "اليوم العالمي للمرأة في العلوم", en: "Women & Girls in Science Day", tag: "social" },
  { month: 2, day: 21, ar: "اليوم العالمي للغة الأم", en: "Mother Language Day", tag: "intl" },
  { month: 3, day: 8, ar: "اليوم العالمي للمرأة", en: "International Women's Day", tag: "social" },
  { month: 3, day: 20, ar: "اليوم العالمي للسعادة", en: "International Day of Happiness", tag: "social" },
  { month: 3, day: 21, ar: "اليوم العالمي للشعر", en: "World Poetry Day", tag: "social" },
  { month: 3, day: 22, ar: "اليوم العالمي للمياه", en: "World Water Day", tag: "intl" },
  { month: 4, day: 7, ar: "يوم الصحة العالمي", en: "World Health Day", tag: "social" },
  { month: 4, day: 21, ar: "يوم الإبداع والابتكار", en: "Creativity & Innovation Day", tag: "business" },
  { month: 4, day: 22, ar: "يوم الأرض العالمي", en: "Earth Day", tag: "intl" },
  { month: 4, day: 23, ar: "اليوم العالمي للكتاب", en: "World Book Day", tag: "social" },
  { month: 5, day: 1, ar: "عيد العمال", en: "Labour Day", tag: "business" },
  { month: 5, day: 3, ar: "اليوم العالمي لحرية الصحافة", en: "Press Freedom Day", tag: "intl" },
  { month: 5, day: 21, ar: "اليوم العالمي للشاي", en: "International Tea Day", tag: "social" },
  { month: 6, day: 5, ar: "اليوم العالمي للبيئة", en: "World Environment Day", tag: "intl" },
  { month: 6, day: 21, ar: "اليوم العالمي لليوغا", en: "International Yoga Day", tag: "social" },
  { month: 6, day: 30, ar: "اليوم العالمي لوسائل التواصل", en: "Social Media Day", tag: "tech" },
  { month: 7, day: 11, ar: "اليوم العالمي للسكان", en: "World Population Day", tag: "intl" },
  { month: 7, day: 17, ar: "اليوم العالمي للإيموجي", en: "World Emoji Day", tag: "tech" },
  { month: 7, day: 30, ar: "اليوم العالمي للصداقة", en: "International Friendship Day", tag: "social" },
  { month: 8, day: 12, ar: "اليوم العالمي للشباب", en: "International Youth Day", tag: "social" },
  { month: 8, day: 19, ar: "اليوم العالمي للتصوير", en: "World Photography Day", tag: "social" },
  { month: 9, day: 8, ar: "اليوم العالمي لمحو الأمية", en: "International Literacy Day", tag: "social" },
  { month: 9, day: 21, ar: "اليوم العالمي للسلام", en: "International Day of Peace", tag: "intl" },
  { month: 9, day: 27, ar: "اليوم العالمي للسياحة", en: "World Tourism Day", tag: "business" },
  { month: 10, day: 1, ar: "اليوم العالمي للقهوة", en: "International Coffee Day", tag: "social" },
  { month: 10, day: 5, ar: "اليوم العالمي للمعلم", en: "World Teachers' Day", tag: "social" },
  { month: 10, day: 10, ar: "اليوم العالمي للصحة النفسية", en: "Mental Health Day", tag: "social" },
  { month: 10, day: 16, ar: "اليوم العالمي للغذاء", en: "World Food Day", tag: "intl" },
  { month: 11, day: 13, ar: "اليوم العالمي للطف", en: "World Kindness Day", tag: "social" },
  { month: 11, day: 19, ar: "اليوم العالمي لريادة الأعمال", en: "Entrepreneurship Day", tag: "business" },
  { month: 11, day: 21, ar: "اليوم العالمي للتلفزيون", en: "World Television Day", tag: "tech" },
  { month: 12, day: 2, ar: "اليوم الوطني للإمارات", en: "UAE National Day", tag: "gulf" },
  { month: 12, day: 3, ar: "اليوم العالمي للأشخاص ذوي الإعاقة", en: "Day of Persons with Disabilities", tag: "social" },
  { month: 12, day: 10, ar: "اليوم العالمي لحقوق الإنسان", en: "Human Rights Day", tag: "intl" },
  { month: 12, day: 18, ar: "اليوم العالمي للغة العربية", en: "World Arabic Language Day", tag: "intl" },
];

/** Occasions in a given month (1-12), sorted by day. */
export function daysInMonth(month: number): WorldDay[] {
  return WORLD_DAYS.filter((d) => d.month === month).sort((a, b) => a.day - b.day);
}

/** Upcoming occasions from a given day of the month onward (then next months),
 * capped at `count`. `month` is 1-12, `day` is the current day-of-month. */
export function upcomingDays(month: number, day: number, count = 6): WorldDay[] {
  const ordered: WorldDay[] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((month - 1 + i) % 12) + 1;
    for (const d of daysInMonth(m)) {
      if (i === 0 && d.day < day) continue;
      ordered.push(d);
    }
    if (ordered.length >= count) break;
  }
  return ordered.slice(0, count);
}
