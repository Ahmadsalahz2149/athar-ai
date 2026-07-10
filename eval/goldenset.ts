import type { DnaExpect, DraftExpect } from "@/lib/eval/rubric";

/** Golden-set eval cases. SEED fixtures — expand with REAL de-identified partner
 * samples over time (the more real dialect coverage, the better the gate). Each
 * case pastes a few short posts in one dialect and asserts what a correct DNA +
 * drafts run must look like. Founder-authored Arabic (ADR: founder owns copy). */

export type GoldenCase = {
  id: string;
  label: string;
  samples: string;
  dna: DnaExpect;
  draft: { topic: string; platform: string; count: number } & DraftExpect;
};

export const GOLDEN_SET: GoldenCase[] = [
  {
    id: "gulf-founder",
    label: "خليجي — مؤسّس تقني",
    samples: [
      "يا جماعة الخير، أهم درس تعلمته من أول مشروع لي: لا تنتظر المنتج يطلع كامل عشان تنزله. نزّله وهو ناقص، والسوق بيعلّمك الباقي.",
      "",
      "صراحة أكثر شي يعطّل الشركات الناشئة عندنا مو الفلوس، السالفة إننا نخاف نبدأ. ابدأ صغير وكبّر على مهلك.",
      "",
      "قاعدة ذهبية: لو ما جاك رفض من عملاء، معناها إنك ما سوّقت كفاية. الرفض جزء من اللعبة، لا تاخذه شخصي.",
    ].join("\n"),
    dna: { dialectKeywords: ["خليج", "سعود"], minCompletion: 30 },
    draft: { topic: "كيف تبدأ مشروعك بدون رأس مال كبير", platform: "LinkedIn", count: 2, minCount: 2 },
  },
  {
    id: "egyptian-creator",
    label: "مصري — صانع محتوى",
    samples: [
      "بص يا صاحبي، مفيش حاجة اسمها إلهام. الإلهام ده بييجي وانت بتشتغل مش وانت قاعد مستني. اقعد اكتب وهو هييجي لوحده.",
      "",
      "أنا بقولها بصراحة: أكبر غلط بتعمله إنك بتقارن بدايتك بنهاية غيرك. كل واحد وله وقته يا معلم.",
      "",
      "الناس فاكرة إن النجاح لحظة، لأ.. النجاح عادات صغيرة بتكررها كل يوم لحد ما تكبر.",
    ].join("\n"),
    dna: { dialectKeywords: ["مصر", "عامية"], minCompletion: 30 },
    draft: { topic: "إزاي تبني عادة الكتابة اليومية", platform: "Instagram", count: 2, minCount: 2 },
  },
  {
    id: "msa-consultant",
    label: "فصحى — مستشار",
    samples: [
      "القيادة الحقيقية ليست في إصدار الأوامر، بل في تهيئة البيئة التي يزدهر فيها الفريق. حين تُتقن الإصغاء، تتضاعف نتائجك.",
      "",
      "إنّ أخطر ما يواجه المؤسسات ليس المنافسة، بل الركون إلى النجاحات السابقة. التطوير المستمر شرطٌ للبقاء.",
      "",
      "لا تقس إنتاجيتك بعدد ساعات العمل، بل بأثر ما تنجزه. الوضوح في الأولويات يسبق الاجتهاد في التنفيذ.",
    ].join("\n"),
    dna: { dialectKeywords: ["فصح", "رسمي", "فصيح"], minCompletion: 30 },
    draft: { topic: "لماذا يسبق الوضوح الاجتهاد", platform: "LinkedIn", count: 2, minCount: 2 },
  },
];
