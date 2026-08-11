# Athar — Landing Page Design Prompt (for Claude Design / Artifacts)

Style derived from the reference set (Startups Advisory.Ai, Apptics, Fondo):
clean light SaaS, bold near-black headlines with a bright gradient accent word,
a "chaos → order" hero flow visual, glassmorphism cards, stat strips with mini
charts, bento features, numbered steps, a comparison table, colored pricing,
testimonials, two-column FAQ, and a giant faded brand wordmark in the footer.

Accent: teal → cyan (on-brand). To match the references' blue instead, swap the
gradient stops to `#2563EB → #38BDF8`.

---

You are a senior product designer at a top studio. Design a single, premium, conversion-focused LANDING PAGE for a SaaS product called "Athar (أثر)". Output one self-contained, fully responsive HTML page (all CSS inline in a <style> tag, no external assets — build any product UI, charts, avatars, and icons as inline SVG/HTML/CSS). The page is ARABIC-FIRST and RTL (dir="rtl", primary language Arabic); include the English copy I provide as an optional LTR mirror, but design and lay it out for Arabic RTL first.

── PRODUCT ──
Athar (أثر) is an AI "Personal Brand Growth OS" for Gulf agencies, founders, and creators. It learns a person's Arabic voice, dialect, tone, and style from their own content ("Content DNA"), then writes on-voice posts, ideas, plans, images, video scenes, and voice-overs — Arabic-first. Audience: Gulf creators & content agencies who want to grow a personal brand without sounding like a robot.

── VISUAL STYLE (match this exactly — it is derived from a reference set) ──
Clean, airy, modern-startup SaaS. Light theme only.
• Backgrounds: near-white with very soft diffuse gradients (white → faint teal/blue tint, subtle radial glows). Lots of negative space.
• Headlines: very bold, tight, near-black (#0F172A), large scale, with ONE accent word rendered in a bright brand GRADIENT. Use the rhetorical hero structure "More X won't Y. Z will."
• Accent gradient: teal → cyan (#0F766E → #14B8A6 → #22D3EE). Use it on the accent word, key CTAs, glowing flow-lines, active states, and mini-charts. (If a bluer look is wanted, swap the gradient stops to #2563EB → #38BDF8.)
• A hand-drawn underline swoosh (in the accent gradient) under a short sub-headline phrase.
• Cards: glassmorphism and clean white cards, 16–24px radius, hairline borders (#E5E7EB), soft diffuse shadows (large blur, low opacity). Subtle inner highlights.
• CTAs: pill/rounded buttons — a primary in the accent gradient (or near-black #0F172A) and a secondary white/outline. Small rocket/arrow icon accents allowed.
• Inline app-icon chips or small emoji-style glyphs may sit inside headlines and labels.
• Motion (CSS only, respect prefers-reduced-motion): gentle float on hero mockups, a draw-in on the flow line, hover lift on cards, count-up feel via static styling.

── TYPOGRAPHY ──
Arabic display: a heavy geometric Arabic face feel (Rubik / Tajawal / IBM Plex Sans Arabic), weights 700–800 for headings. Body Arabic: IBM Plex Sans Arabic. Latin: Inter/Poppins. Set a clear type scale; headings tight and balanced (text-wrap: balance); do NOT apply negative letter-spacing to Arabic.

── THE SIGNATURE HERO VISUAL (most important — "chaos → order") ──
Left/start side: a cluster of scattered, tilted, semi-transparent glass cards representing NOISE — raw notes, random posts, a voice memo, mixed dialects, notification badges (e.g. "23", "17"). They look busy and unaligned.
A glowing accent-gradient flow-line/arrow sweeps them INTO a single clean, structured panel on the right/end side titled "بصمة المحتوى / Content DNA": it shows Dialect: خليجية (Gulf), Tone: واثقة · مباشرة · ملهمة, and a circular "مطابقة صوتك / Voice match 88%" ring. Below/beside it, one polished "post in your voice" card (hook + body) with a small avatar. This is the thesis: scattered content → your one clear voice.

── PAGE SECTIONS (in order) ──
1) Sticky glass nav: logo "أثر" + ✦ mark, links (المميزات، كيف يعمل، الأسعار، الأسئلة), "دخول", and a gradient pill CTA "ابدأ مجانًا".
2) HERO: eyebrow pill "نظام نمو العلامة الشخصية بالذكاء الاصطناعي". Headline: "المزيد من المحتوى لن يُنمّي علامتك. صوتك سيفعل." with "صوتك" in the accent gradient. Sub-headline with a hand-underline: "بصمتك، بوضوح." Supporting line: "أثر يتعلّم لهجتك ونبرتك من محتواك، ثم يكتب بصوتك — بالعربية أولًا." Two CTAs (gradient "ابدأ مجانًا" + outline "شاهد كيف يعمل"). Trust line: "٢٠٠ نقطة مجانية · بدون بطاقة · جاهز خلال دقائق". Right: the signature chaos→order visual above.
3) STAT STRIP: 4 metrics with big gradient numbers + tiny sparkline each — ٨٨٪ مطابقة الصوت · عربي+إنجليزي لغات ولهجات · دقائق للإطلاق · ∞ محتوى أكثر تأثيرًا.
4) HOW IT WORKS — 3 numbered steps (٠١ ارفع محتواك · ٠٢ يتعلّم بصمتك · ٠٣ اكتب بصوتك) each with a small product mockup.
5) FEATURES bento grid (8 cards, icon + mini product screenshot + short copy): بصمة الصوت، استديو المحتوى، استديو الميديا، المشاهد الرقمية، محتوى ثنائي اللغة، خطة شهرية، أفكار لا تنضب، تحليلات حقيقية. Make the "بصمة الصوت" card visually featured.
6) SHOWCASE — a dark rounded panel "استديو إبداعي متكامل" with tabs (صور / فيديو / تعليق صوتي) and a large device-style preview.
7) INTERACTIVE-FEEL CALCULATOR card: "كم يوفّر لك أثر؟" — inputs (منشورات شهريًا، ساعات لكل منشور) and a big gradient result number (e.g. الوقت الموفّر شهريًا). Styled like a real calculator card.
8) COMPARISON TABLE: "لماذا أثر يتفوّق" — feature rows, an "الآخرون" column with red ✗, and a highlighted brand-gradient "أثر" column with ✓ (يفهم اللهجة الخليجية، يحافظ على صوتك، عربي أولًا، أفكار+خطة+ميديا في مكان واحد، تعدّد العلامات للوكالات).
9) PRICING: 3 tiers (تجربة ٠ · احترافي ٩٩ ريال «الأكثر شيوعًا» highlighted in the accent gradient · وكالة ٢٩٩) with feature check-lists and CTAs. Note "الأسعار بالريال السعودي شاملة الضريبة".
10) TESTIMONIALS: 3 Gulf personas with avatar, name, role, 5 gold stars, and large quote marks.
11) FAQ: two-column accordion, 6 questions (كيف يتعلّم أثر صوتي؟ · هل يدعم اللهجات الخليجية؟ · هل أحتاج بطاقة؟ · هل المحتوى جاهز للنشر؟ · هل يصلح للوكالات؟ · ما اللغات المدعومة؟).
12) FINAL CTA band in the accent gradient: "ابنِ أثرك الرقمي اليوم." + gradient/white CTA, with a GIANT faded "أثر" wordmark behind the footer.
13) FOOTER: brand + tagline, columns (المنتج، الشركة، قانوني), social, copyright.

── QUALITY BAR ──
Every section must feel intentional and premium, matching the reference style's polish: soft shadows, glass, generous spacing, crisp alignment, and the teal→cyan accent used with restraint. Fully responsive: on mobile, stack columns, collapse nav to a menu, and keep the hero visual legible. Build all mockups, charts, avatars, badges, and icons as inline SVG/CSS — no image URLs. Deliver one complete HTML file.
