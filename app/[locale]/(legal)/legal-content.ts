/**
 * Real (draft) legal copy for Terms / Privacy / Refund, bilingual. These are
 * genuine starting policies that reflect how Athar actually operates (data
 * collected, sub-processors, "no training on your content", credit model). They
 * are NOT a substitute for review by qualified legal counsel before relying on
 * them — the founder should have them reviewed and confirm the contact email,
 * company entity, and governing-law jurisdiction.
 */
export type LegalSection = { h: string; p: string[] };
export type LegalDoc = { updated: string; intro: string; sections: LegalSection[] };

const CONTACT = "support@athargrowth.com";
const UPDATED_AR = "أغسطس 2026";
const UPDATED_EN = "August 2026";

const AR = {
  terms: {
    updated: UPDATED_AR,
    intro: "تحكم هذه الشروط استخدامك لمنصة أثر («الخدمة»). باستخدامك للخدمة فأنت توافق عليها.",
    sections: [
      { h: "1. الخدمة", p: ["أثر أداة لمساعدتك على تعلّم أسلوب كتابتك («بصمة المحتوى») وتوليد محتوى بصوتك. الخدمة في مرحلة تطوير مستمر وقد تتغيّر ميزاتها."] },
      { h: "2. الحساب والأهلية", p: ["أنت مسؤول عن دقة بيانات حسابك وسرية كلمة المرور، وعن كل نشاط يتم عبر حسابك. يجب ألا يقل عمرك عن 18 عامًا."] },
      { h: "3. الاستخدام المقبول", p: ["توافق على عدم استخدام الخدمة لأي غرض غير قانوني، أو لإنتاج محتوى ينتهك حقوق الغير أو قوانين المنصات التي تنشر عليها. نحتفظ بحق تعليق الحسابات المخالفة."] },
      { h: "4. المحتوى والملكية", p: ["أنت تملك المحتوى الذي ترفعه والمحتوى الذي تولّده. تمنحنا ترخيصًا محدودًا لمعالجة محتواك لغرض تشغيل الخدمة لك فقط.", "لا نستخدم محتواك لتدريب نماذج ذكاء اصطناعي."] },
      { h: "5. المحتوى المولّد بالذكاء الاصطناعي", p: ["المحتوى المولّد قد يحتاج مراجعة وتعديل. أنت المسؤول الوحيد عن مراجعة أي محتوى قبل نشره، ولا نضمن نتائج تسويقية محددة."] },
      { h: "6. الأرصدة (Credits) والدفع", p: ["تُخصم عمليات التوليد من رصيد مدفوع مسبقًا. الأرصدة ليس لها قيمة نقدية ولا تُستبدل نقدًا، وتخضع لسياسة الاسترداد أدناه."] },
      { h: "7. المنصات الخارجية", p: ["ميزة التوزيع مُساعِدة: النظام يجهّز المحتوى وتنشره أنت. أنت مسؤول عن الالتزام بشروط كل منصة تنشر عليها."] },
      { h: "8. توافر الخدمة", p: ["تُقدَّم الخدمة «كما هي» دون ضمان توافر متواصل في هذه المرحلة. قد تحدث فترات صيانة أو انقطاع."] },
      { h: "9. حدود المسؤولية", p: ["إلى الحد الذي يسمح به القانون، لا نتحمّل مسؤولية أي أضرار غير مباشرة أو تبعية ناتجة عن استخدام الخدمة."] },
      { h: "10. التعديلات والإنهاء", p: ["قد نحدّث هذه الشروط أو نوقف الخدمة مع إشعار معقول. يمكنك إنهاء استخدامك في أي وقت."] },
      { h: "11. القانون الحاكم والتواصل", p: [`تخضع هذه الشروط لقوانين الجهة التي تُشغَّل منها الخدمة (يُحدَّد قبل الإطلاق الرسمي). للتواصل: ${CONTACT}`] },
    ],
  },
  privacy: {
    updated: UPDATED_AR,
    intro: "توضح هذه السياسة البيانات التي نجمعها وكيف نستخدمها ونحميها.",
    sections: [
      { h: "1. ما الذي نجمعه", p: ["بيانات الحساب (البريد الإلكتروني، الاسم)، والمحتوى الذي ترفعه أو تولّده، وبيانات الاستخدام الأساسية لتشغيل الخدمة."] },
      { h: "2. كيف نستخدم بياناتك", p: ["لتشغيل الخدمة لك: تعلّم بصمة محتواك، توليد المحتوى، وإدارة حسابك ورصيدك. لا نبيع بياناتك."] },
      { h: "3. مزوّدو الخدمة (Sub-processors)", p: ["نستعين بمزوّدين لتشغيل الخدمة: Supabase (الاستضافة وقاعدة البيانات والمصادقة)، Anthropic (توليد النصوص)، Voyage (الـ embeddings)، إضافةً إلى مزوّدي وسائط عند استخدام ميزات الصوت/الصورة/الفيديو. يعالج كلٌّ منهم البيانات بالقدر اللازم لأداء وظيفته."] },
      { h: "4. لا تدريب على محتواك", p: ["لا نستخدم محتواك لتدريب نماذج الذكاء الاصطناعي."] },
      { h: "5. الاحتفاظ بالبيانات", p: ["تُحذف الملفات الخام بعد معالجتها ويُحتفظ بالنص المشتق اللازم لعمل بصمة المحتوى. تُحفظ بياناتك ما دام حسابك نشطًا."] },
      { h: "6. الأمان", p: ["نطبّق عزلًا للبيانات بين الحسابات وضوابط وصول. لا يمكن ضمان أمان مطلق، لكننا نتبع ممارسات معقولة لحماية بياناتك."] },
      { h: "7. حقوقك", p: [`لك حق الوصول إلى بياناتك وتصحيحها وحذفها وتصديرها. حتى تتوفّر أدوات ذاتية لذلك، تواصل معنا على ${CONTACT} وسننفّذ طلبك.`] },
      { h: "8. ملفات تعريف الارتباط", p: ["نستخدم ملفات ضرورية لتسجيل الدخول وإدارة الجلسة فقط."] },
      { h: "9. التعديلات والتواصل", p: [`قد نحدّث هذه السياسة مع إشعار معقول. للتواصل بخصوص الخصوصية: ${CONTACT}`] },
    ],
  },
  refund: {
    updated: UPDATED_AR,
    intro: "توضح هذه السياسة شروط استرداد الأرصدة والاشتراكات.",
    sections: [
      { h: "1. طبيعة الأرصدة", p: ["الأرصدة مدفوعة مسبقًا وتُستهلك عند كل عملية توليد. الرصيد المُستهلَك (المحتوى الذي وُلِّد فعليًا) غير قابل للاسترداد لأنه يمثّل تكلفة معالجة فعلية."] },
      { h: "2. نافذة الاسترداد", p: ["يمكنك طلب استرداد الرصيد غير المستهلَك خلال 14 يومًا من الشراء، ما لم يُنص على خلاف ذلك وقت الشراء."] },
      { h: "3. كيفية الطلب", p: [`أرسل طلب الاسترداد إلى ${CONTACT} من البريد المرتبط بحسابك موضّحًا رقم العملية. نراجع الطلب ونردّ خلال مدة معقولة.`] },
      { h: "4. المعالجة", p: ["تتم عمليات الاسترداد المعتمدة عبر وسيلة الدفع الأصلية أو بالطريقة المتفق عليها. قد تختلف مدة الوصول حسب مزوّد الدفع."] },
      { h: "5. الحالات الاستثنائية", p: ["نتعامل مع الحالات الخاصة (خطأ فني منعك من استخدام الخدمة مثلًا) بحسن نية وقد نمنح رصيدًا تعويضيًا."] },
    ],
  },
} satisfies Record<string, LegalDoc>;

const EN = {
  terms: {
    updated: UPDATED_EN,
    intro: "These Terms govern your use of the Athar platform (the “Service”). By using the Service you agree to them.",
    sections: [
      { h: "1. The Service", p: ["Athar helps you learn your writing style (“Content DNA”) and generate content in your voice. The Service is under active development and features may change."] },
      { h: "2. Account & eligibility", p: ["You are responsible for the accuracy of your account details, the confidentiality of your password, and all activity under your account. You must be at least 18 years old."] },
      { h: "3. Acceptable use", p: ["You agree not to use the Service for any unlawful purpose or to produce content that infringes others’ rights or violates the rules of the platforms you publish to. We may suspend accounts in breach."] },
      { h: "4. Content & ownership", p: ["You own the content you upload and the content you generate. You grant us a limited license to process your content solely to operate the Service for you.", "We do not use your content to train AI models."] },
      { h: "5. AI-generated content", p: ["Generated content may need review and editing. You are solely responsible for reviewing any content before publishing it, and we do not guarantee specific marketing results."] },
      { h: "6. Credits & payment", p: ["Generations are metered against a prepaid credit balance. Credits have no cash value and are not exchangeable for cash; they are subject to the Refund Policy below."] },
      { h: "7. Third-party platforms", p: ["Distribution is assisted: the app prepares the content and you publish it. You are responsible for complying with each platform’s terms."] },
      { h: "8. Availability", p: ["The Service is provided “as is” with no guarantee of continuous availability at this stage. Maintenance or interruptions may occur."] },
      { h: "9. Limitation of liability", p: ["To the extent permitted by law, we are not liable for any indirect or consequential damages arising from use of the Service."] },
      { h: "10. Changes & termination", p: ["We may update these Terms or discontinue the Service with reasonable notice. You may stop using the Service at any time."] },
      { h: "11. Governing law & contact", p: [`These Terms are governed by the laws of the jurisdiction from which the Service is operated (to be finalized before public launch). Contact: ${CONTACT}`] },
    ],
  },
  privacy: {
    updated: UPDATED_EN,
    intro: "This policy explains what data we collect and how we use and protect it.",
    sections: [
      { h: "1. What we collect", p: ["Account data (email, name), the content you upload or generate, and basic usage data needed to run the Service."] },
      { h: "2. How we use it", p: ["To operate the Service for you: learning your Content DNA, generating content, and managing your account and credits. We do not sell your data."] },
      { h: "3. Sub-processors", p: ["We rely on providers to run the Service: Supabase (hosting, database, auth), Anthropic (text generation), Voyage (embeddings), plus media providers when you use voice/image/video features. Each processes data only as needed for its function."] },
      { h: "4. No training on your content", p: ["We do not use your content to train AI models."] },
      { h: "5. Data retention", p: ["Raw uploads are deleted after processing; the derived text needed for your Content DNA is retained. Your data is kept while your account is active."] },
      { h: "6. Security", p: ["We enforce per-account data isolation and access controls. No system is perfectly secure, but we follow reasonable practices to protect your data."] },
      { h: "7. Your rights", p: [`You may access, correct, delete, and export your data. Until self-serve tools are available, contact us at ${CONTACT} and we will action your request.`] },
      { h: "8. Cookies", p: ["We use only essential cookies for sign-in and session management."] },
      { h: "9. Changes & contact", p: [`We may update this policy with reasonable notice. Privacy contact: ${CONTACT}`] },
    ],
  },
  refund: {
    updated: UPDATED_EN,
    intro: "This policy explains refunds for credits and subscriptions.",
    sections: [
      { h: "1. Nature of credits", p: ["Credits are prepaid and consumed on each generation. Consumed credits (content actually generated) are non-refundable, as they represent real processing cost."] },
      { h: "2. Refund window", p: ["You may request a refund of unused credits within 14 days of purchase, unless stated otherwise at the time of purchase."] },
      { h: "3. How to request", p: [`Email ${CONTACT} from your account’s email with the transaction reference. We review and respond within a reasonable time.`] },
      { h: "4. Processing", p: ["Approved refunds are issued to the original payment method or as otherwise agreed. Arrival time may vary by payment provider."] },
      { h: "5. Exceptional cases", p: ["We handle special cases (e.g., a technical fault that prevented you from using the Service) in good faith and may grant compensatory credit."] },
    ],
  },
} satisfies Record<string, LegalDoc>;

export function legalContent(locale: string) {
  return locale === "en" ? EN : AR;
}
