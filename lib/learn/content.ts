/** Learning center lessons (#18) + Help FAQ (#26). Curated in-app content
 * (concise guides, not hosted videos), so it works with no external media. */

export type Lesson = { id: string; ar: { title: string; body: string; mins: number }; en: { title: string; body: string; mins: number }; href?: string };
export type Faq = { ar: { q: string; a: string }; en: { q: string; a: string } };

export const LESSONS: Lesson[] = [
  {
    id: "dna",
    href: "/dna",
    ar: { title: "ابنِ بصمتك (Content DNA)", mins: 3, body: "ارفع ٣–٥ من بوستاتك القديمة في «مكتبة المعرفة»، والذكاء يستخرج صوتك ولهجتك وأنماط هوكاتك. كل ما رفعت أكثر، صارت البصمة أدق. راجعها من صفحة «بصمة المحتوى» وعدّل أي شيء يدويًا." },
    en: { title: "Build your Content DNA", mins: 3, body: "Upload 3–5 of your old posts in the Knowledge Vault; the AI extracts your voice, dialect and hook patterns. The more you add, the sharper it gets. Review it on the Content DNA page and tweak anything by hand." },
  },
  {
    id: "identity",
    href: "/brand",
    ar: { title: "عمّق هوية علامتك", mins: 4, body: "في «الهوية» أضف منتجاتك وخدماتك، قيود المحتوى (اللي الذكاء لازم يلتزم بيها)، وأوصاف علامتك بثلاث مستويات. ده بيخلّي كل بوست يشير لما تبيعه فعلًا ولا يكسر قواعدك." },
    en: { title: "Deepen your brand identity", mins: 4, body: "In Identity, add your products/services, content constraints (rules the AI must follow), and 3-level brand descriptions. This makes every post reference what you actually sell and never break your rules." },
  },
  {
    id: "studio",
    href: "/studio",
    ar: { title: "اكتب أول بوست بصوتك", mins: 3, body: "من «الاستوديو» اكتب موضوعك، اختر المنصّة والنبرة، والذكاء يكتب بصوتك (٣ هوكس + متن). استخدم أدوات إعادة الصياغة (أطول/أقصر/إيموجي) لضبط النص." },
    en: { title: "Write your first post", mins: 3, body: "In the Studio, type your topic, pick platform + tone, and the AI writes in your voice (3 hooks + body). Use the rewrite tools (longer/shorter/emoji) to fine-tune." },
  },
  {
    id: "plan",
    href: "/plan",
    ar: { title: "خطّط شهرك كاملًا", mins: 2, body: "من «مركز التخطيط» اضغط «ولّد الخطة» لتحصل على خطة منشورات موزّعة على الشهر + اتجاهات مجالك + الأيام العالمية. كل بند بضغطة يفتح الاستوديو." },
    en: { title: "Plan your whole month", mins: 2, body: "In the Planning Hub, click Generate plan for a month of posts spread across the days + your field's trends + world days. Each item opens the Studio in one click." },
  },
  {
    id: "distribute",
    href: "/distribute",
    ar: { title: "وزّع بوستاتك بأمان", mins: 4, body: "«مركز التوزيع» يفهم جمهورك ويولّد كلمات بحث عن الجروبات، ويجهّز شيت جروبات + نشر مُساعَد بضغطة. التوزيع «إنسان في الحلقة» — يحمي حسابك من الحظر." },
    en: { title: "Distribute safely", mins: 4, body: "The Distribution Hub understands your audience, generates group-search keywords, and gives you a groups sheet + one-click assisted posting. It's human-in-the-loop — it protects your account from bans." },
  },
  {
    id: "media",
    href: "/media",
    ar: { title: "حوّل بوستاتك لوسائط", mins: 3, body: "«استوديو الوسائط» يحوّل نصّك إلى تعليق صوتي، ويولّد صورًا وفيديوهات بالذكاء الاصطناعي — جاهزة للتحميل والنشر." },
    en: { title: "Turn posts into media", mins: 3, body: "The Media Studio turns your text into a voice-over and generates AI images and videos — ready to download and post." },
  },
];

export const FAQ: Faq[] = [
  { ar: { q: "إزاي الذكاء بيتعلّم صوتي؟", a: "برفع بوستاتك القديمة في «مكتبة المعرفة»؛ الذكاء يحلّلها ويبني «بصمة المحتوى» (لهجتك، نبرتك، أنماط هوكاتك). كل ما رفعت أكثر، صارت أدقّ." }, en: { q: "How does the AI learn my voice?", a: "By uploading your old posts to the Knowledge Vault; the AI analyzes them and builds your Content DNA (dialect, tone, hook patterns). The more you upload, the sharper it gets." } },
  { ar: { q: "ليه بصمتي ٠٪؟", a: "لأنك لسه ما بنيتها. ارفع مصادرك ثم اضغط «ابنِ بصمتي» من صفحة بصمة المحتوى — رفع الملفات وحده لا يكفي، لازم خطوة البناء." }, en: { q: "Why is my DNA at 0%?", a: "Because it hasn't been built yet. Upload sources, then click Build my DNA on the Content DNA page — uploading files alone isn't enough, the build step is required." } },
  { ar: { q: "هل التوزيع على الجروبات آمن؟", a: "نعم — لأنه «مُساعَد» وليس تلقائيًا. النظام يجهّز البوست ويفتح الجروب، وأنت تنشر بضغطة. الأتمتة الكاملة تخالف شروط فيسبوك وتعرّض حسابك للحظر." }, en: { q: "Is group distribution safe?", a: "Yes — it's assisted, not automated. The system prepares the post and opens the group; you post with one click. Full automation violates Facebook's rules and risks account bans." } },
  { ar: { q: "إزاي أحصل على كريديت؟", a: "كل حساب يبدأ برصيد مجاني. تقدر تحصل على المزيد باستبدال كوبون من صفحة «الفوترة»، أو عبر الباقات (قريبًا)." }, en: { q: "How do I get credits?", a: "Every account starts with a free grant. Get more by redeeming a coupon on the Billing page, or via plans (coming soon)." } },
  { ar: { q: "أقدر أدير أكثر من علامة؟", a: "نعم — من صفحة «الهوية» أضف علامات متعددة وبدّل بينها؛ لكل علامة بصمتها ومحتواها المنفصل." }, en: { q: "Can I manage multiple brands?", a: "Yes — on the Identity page, add multiple brands and switch between them; each keeps its own DNA and content." } },
  { ar: { q: "منتجاتي وبياناتي آمنة؟", a: "بياناتك معزولة تمامًا لكل حساب على مستوى قاعدة البيانات، ولا تُشارَك مع أي طرف. المحتوى المرفوع يُستخدم فقط لبناء بصمتك." }, en: { q: "Is my data safe?", a: "Your data is fully isolated per account at the database level and never shared. Uploaded content is only used to build your DNA." } },
];
