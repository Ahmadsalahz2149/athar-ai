# Athar AI — UI Build Plan (design parity)

Derived from a screen-by-screen audit of all 41 prototype screenshots
(`~/Desktop/الشاشات/`) against the current implementation. All 17 screens ARE
designed in the prototype. This plan lists every element to build. Wiring/logic
comes in a later plan — this one is about the UI existing and matching.

Legend: ✅ exists & matches · 🟡 exists but simplified · ⬜ missing entirely

---

## 0) Shared shell + design primitives (build FIRST — everything depends on it)

### 0.1 Sidebar (dark navy, right, RTL)
- 🟡 Brand lockup: logo + `أثر AI` + sub-label `Growth OS` ⬜(sub-label missing)
- ⬜ Nav order/labels must be exactly: `الرئيسية` · `مكتبة المعرفة` · `بصمة المحتوى` · `بنك الأفكار` · `استوديو المحتوى` · `التقويم` · `الموافقات` · `التحليلات` · `الإعدادات`
- ⬜ Active state = teal-tinted pill + accent bar on the inner edge
- ⬜ `الموافقات` amber count badge (live pending count)
- 🟡 Plan card: `الخطة المجانية` + `استهلكت ٣ من ٥ ملفات معرفة` + usage bar + ⬜ gold **upgrade CTA**

### 0.2 Top header
- 🟡 Search input `ابحث داخل ملفاتك وأفكارك...` (exists, needs design styling + real results dropdown later)
- 🟡 Primary teal button `أنشئ بوست` with `+` icon
- 🟡 Bell icon + unread dot
- ⬜ Account chip: avatar initial + **name** `أحمد العتيبي` + **role** `مدرّب أعمال` (we only show an avatar circle)

### 0.3 Component primitives (build once, reuse)
- ⬜ `StatusPill` variants: teal (`تم التحليل`), amber (`جاري التحليل`), red (`يحتاج مراجعة`), neutral (`مستخدمة`), mint (`تم استخدامها في DNA`), green (`جديدة`), amber (`محفوظة`)
- ⬜ `FileTypeBadge` color-coded: PDF (red) · MP4 (blue) · MP3 (teal) · TXT (grey) · URL (amber)
- ⬜ `ScoreRadial` (donut w/ centre value) — used by DNA %, Post Score
- ⬜ `ProgressMeter` (horizontal, teal gradient)
- ⬜ `SegmentMeter` (3-segment bar; teal & amber variants)
- ⬜ `SelectableChip` (single & multi select; selected = navy fill OR teal outline per context)
- ⬜ `SelectableCard` (with teal check-circle)
- ⬜ `StatCard` (icon tile + value + label + delta)
- ⬜ `DarkCard` (navy insight/recommendation card w/ ✦ eyebrow)
- ⬜ `NumberedStepper` (vertical, teal badges + amber last)
- ⬜ `Dropzone` (dashed, icon tile, CTA row)
- ⬜ `CountBadge` (amber/teal circular)
- ⬜ `EmptyState` (dashed container + title + body + CTA)
- ⬜ `PlatformBadge` (in / X / ig + colors)
- ⬜ **Numeral policy decision**: prototype mixes Arabic-Indic and Western. Rule to adopt: Arabic-Indic for prose/dates/counts in `/ar`; Western for scores/percentages/prices (matches prototype's dominant usage).

---

## 1) Sign Up — `إنشاء حساب` (`/signup`)  [current: 🟡 merged into /login]
Split it out of the login toggle into its own screen.
- ⬜ Two-column full-bleed split: form (right) + navy brand panel (left)
- ⬜ Brand panel: pill `Personal Brand Growth OS ✦`; H1 `ابدأ بتحويل خبرتك إلى محتوى يصنع أثرًا` (`أثرًا` in gold); sub-line; 3 feature rows w/ icon tiles (`يحلّل ملفاتك ويستخرج أقوى أفكارك` · `يتعلّم أسلوبك ويبني بصمة محتواك` · `يولّد بوستات وأفكارًا جاهزة للنشر`); testimonial card (quote + avatar `ل` + `لمى الراشد` + `مدرّبة تطوير ذاتي`)
- ⬜ Form: logo + `أثر AI` + `Personal Brand Growth OS`; H1 `إنشاء حساب جديد`; sub-line
- ⬜ OAuth buttons: `LinkedIn` + `Google` (needs provider config — see NEEDS INTERVENTION)
- ⬜ Divider `أو عبر البريد`
- ⬜ Fields: `الاسم الكامل` (ph `أحمد العتيبي`), `البريد الإلكتروني` (ph `you@example.com`), `كلمة المرور` + `تأكيد كلمة المرور` (2-up)
- ⬜ `نوع الحساب` 2×2 SelectableCards: `صاحب كورس` · `مدرب / استشاري` · `صانع محتوى` · `وكالة` (single-select + check)
- ⬜ CTA `إنشاء الحساب ←`; trust line `🛡 تجربة مجانية — بدون بطاقة بنكية`; footer `لديك حساب بالفعل؟ تسجيل الدخول`
- ⬜ Validation states (email format, password match) + loading state

## 2) Login — `تسجيل دخول` (`/login`)  [current: 🟡]
- ⬜ Two-column split + navy panel: H1 `محتواك ينتظرك، وأثرك يكبر كل يوم.`; sub-line; card `في انتظارك اليوم` / `٨ أفكار محتوى جاهزة للمراجعة` / `راجعها وانشرها خلال دقائق` (lightbulb tile)
- ⬜ H1 `مرحبًا بعودتك إلى أثر AI` + sub `أكمل بناء محتواك من حيث توقفت.`
- ⬜ OAuth `LinkedIn` + `Google`; divider `أو`
- 🟡 Email + password fields (restyle)
- ⬜ `تذكّرني` checkbox + `نسيت كلمة المرور؟` on one row
- 🟡 CTA `تسجيل الدخول`; footer `ليس لديك حساب؟ إنشاء حساب جديد`

## 3) Forgot password — `استعادة` (`/forgot-password`)  [current: 🟡]
- ⬜ Two-column split + navy panel: H1 `بياناتك بأمان، وأثرك محفوظ.`; paragraph; security card (shield tile + `حماية حسابك` + `رابط الاستعادة صالح لمدة ٣٠ دقيقة فقط` + `لأمان إضافي، لا تشارك الرابط مع أحد.`)
- ⬜ Back link `العودة لتسجيل الدخول` (top)
- 🟡 H1 `استعادة كلمة المرور` + sub + email field + CTA `إرسال رابط الاستعادة`
- ⬜ Footer `تذكرت كلمة المرور؟ تسجيل الدخول` (gold underline)
- 🟡 Sent-confirmation state (exists; restyle to match)

## 4) Onboarding 1 — `تهيئة ١` (`/onboarding/1`)  [current: ⬜ we have a 1-step paste/interview instead]
- ⬜ Slim header: logo + `تخطي الآن`
- ⬜ 3-segment progress + `الخطوة 1 من 3`
- ⬜ H1 `لنبدأ ببناء بصمة محتواك` + sub
- ⬜ `ما مجال خبرتك؟` chips: ريادة الأعمال · التعليم · الصحة · العقار · التدريب · الذكاء الاصطناعي · التسويق
- ⬜ `من جمهورك الأساسي؟` chips: صناع محتوى · مدربون · موظفون · طلاب · أصحاب مشاريع · مبتدئون
- ⬜ `ما نوع البراند الشخصي الخاص بك؟` 3×2 SelectableCards w/ descriptions: مستشار (تحل مشكلات محددة) · مدرب (ترافق جمهورك خطوة بخطوة) · خبير (تشارك معرفتك العميقة) · وكالة (تدير علامات شخصية) · صانع محتوى (تبني جمهورًا وتأثيرًا) · صاحب كورس (تبيع منتجات تعليمية)
- ⬜ `اللغة أو اللهجة المفضلة` chips: إنجليزي · مصري · خليجي · سعودي · فصحى بسيطة
- ⬜ Footer: navy `التالي ←` + `رجوع`

## 5) Onboarding 2 — `تهيئة ٢` (`/onboarding/2`)  [⬜]
- ⬜ Progress `الخطوة 2 من 3`
- ⬜ H1 `ما الهدف من محتواك؟` + sub `سنستخدم هذه الإجابات لتوليد أفكار وبوستات تخدم هدفك الحقيقي.`
- ⬜ `أهدافك من المحتوى` + hint `(اختر أكثر من هدف)` — 2-col multi-select rows: بناء جمهور · زيادة التفاعل · بيع كورس · حجز استشارات · بناء سلطة وخبرة · توليد عملاء محتملين · تحسين الظهور على لينكدإن
- ⬜ `منصات النشر` chips: LinkedIn · Instagram · X / Twitter · Facebook · TikTok · YouTube Shorts · WhatsApp
- ⬜ `معدّل النشر` option cards: 3 مرات أسبوعيًا · 5 مرات أسبوعيًا · يوميًا · حسب اقتراح الذكاء الاصطناعي
- ⬜ `أسلوب المحتوى المفضل` chips: تعليمي · قصصي · بيعي ناعم · تحليلي · جدلي · مختصر وسريع
- ⬜ Footer: navy `التالي ←` + `رجوع`

## 6) Onboarding 3 — `تهيئة ٣` (`/onboarding/3`)  [⬜]
- ⬜ Progress `الخطوة 3 من 3` (all filled)
- ⬜ H1 `ارفع أول مصدر معرفة` + sub `ارفع فيديو، PDF، فويس أوفر، أو بوستات قديمة حتى يتعلم أثر AI أسلوبك ويستخرج أفكارك.`
- ⬜ Dropzone: `اسحب وأفلت ملفك هنا` + `رابط يوتيوب · PDF · MP4 · MP3 · DOCX · TXT` + buttons `رفع ملف` (teal) · `لصق رابط يوتيوب` · `لصق ٣ بوستات سابقة`
- ⬜ File-progress card: type badge, filename, amber pill `● جاري التحليل`, size, `68%`, progress bar
- ⬜ Analysis checklist 2×2 w/ 3 states (done/active/pending): `استخراج الأفكار` · `تحليل النبرة` · `بناء Content DNA` · `اقتراح أول ١٠ بوستات`
- ⬜ Footer: teal `الدخول إلى لوحة التحكم ←` + `رجوع`

## 7) Dashboard — `الرئيسية` (`/dashboard`)  [current: 🟡 simplified]
- ⬜ Greeting H1 `مرحبًا أحمد، جاهز لصناعة أثر جديد اليوم؟ 👋` + sub `هذه نظرة سريعة على محتواك، أفكارك، وجدول النشر.`
- ⬜ Status pill `● آخر تحليل قبل ساعتين`
- 🟡 KPI row → must be **5 cards w/ icon tiles**: navy `اكتمال Content DNA` (radial `82%` + delta `+6% هذا الأسبوع`) · `ملفات المعرفة` 12 · `أفكار جاهزة` 48 · `بانتظار الموافقة` 7 + red `يحتاج إجراء` · `منشورات مجدولة` 14
- 🟡 Recommendation navy card: eyebrow `✦ توصية أثر الذكية` + body w/ emphasis + **2 CTAs** `أنشئ البوستات الآن` (teal) + `عرض التفاصيل` (ghost)
- 🟡 `خط إنتاج المحتوى` + `عرض الكل` → **5 tinted stage cards with chevrons**: أفكار 48 · قيد الكتابة 9 · مراجعة 7 · مجدول 14 · منشور 63
- ⬜ Card `إجراءات سريعة`: ارفع مصدر معرفة · أنشئ بوست جديد · ابدأ حملة محتوى · راجع الموافقات (+amber 7)
- ⬜ Card `أحدث الملفات` + link `المكتبة`: 3 rows w/ type badge + filename + `تم التحليل · ٢٤٠ فكرة` / `جاري التحليل · ٧٢٪`
- 🟡 Card `محتوى اليوم المقترح` + chip `٣ أفكار`: rows w/ icon tile + title + `تعليمي · Post Score 92` + navy `اكتب` button
- ⬜ Card `جدول هذا الأسبوع` + `٥ منشورات`: 7-day strip (السبت→الجمعة) w/ cell states (today outlined · scheduled mint+dot · amber+dot)

## 8) Upload — `رفع محتوى` (`/ingest`)  [current: 🟡]
- ⬜ H1 `ارفع محتواك الخام` + sub `كل فيديو، ملف، أو فكرة يمكن أن تتحول إلى محتوى جاهز للنشر.`
- 🟡 Dropzone: `اسحب وأفلت ملفاتك هنا` + `أو اختر من جهازك — يمكنك رفع أكثر من ملف دفعة واحدة` + teal `اختر ملفًا`
- 🟡 `نوع المحتوى` — 7 **icon tiles** (not plain chips): فيديو · صوت · PDF · كتاب · مستند · رابط · بوستات
- ⬜ Card `ماذا تريد أن يفعل أثر AI؟` multi-chips: تحليل فقط · استخراج أفكار · توليد بوستات · بناء Content DNA · تحويل إلى حملة
- ⬜ `لغة المحتوى` chips: عربي · إنجليزي · مختلط
- ⬜ `تصنيف المصدر` chips: كورس · محاضرة · كتاب · سكريبت · لايف · مقابلة
- ⬜ Full-width navy CTA `✦ بدء التحليل`
- ⬜ Left rail navy card `✦ خلف الكواليس` / `ماذا سيحدث بعد الرفع؟` + 5-step NumberedStepper (تفريغ المحتوى · استخراج الأفكار · تحليل النبرة · اقتراح بوستات · تحديث بصمة المحتوى — last badge amber)
- ⬜ Multi-file queue w/ independent progress
- ⬜ Free-plan gate at 5 sources → upgrade prompt

## 9) Knowledge Vault — `المكتبة` (`/vault`)  [current: 🟡]
- 🟡 H1 `مكتبة المعرفة` + sub `كل مصادر خبرتك في مكان واحد، جاهزة للتحليل والتحويل إلى محتوى.`
- 🟡 CTA `+ رفع مصدر جديد`
- ⬜ Search input `ابحث داخل ملفاتك وأفكارك...`
- ⬜ Filter chips: الكل · فيديو · صوت · PDF · روابط · بوستات · تم التحليل · يحتاج مراجعة
- 🟡 3-col card grid → each card needs: type badge · filename · upload date (`٢١ يونيو ٢٠٢٦`) · **description** · **tag chips** · **2-stat block** (`٢٤ فكرة` / `٨ بوست`) · status pill · **2 buttons** `عرض التحليل` (navy) + `توليد محتوى` (outline)
- ⬜ Filtered-empty + global-empty states

## 10) File Analysis — `تحليل ملف` (`/vault/[id]`)  [current: 🟡]
- ⬜ Breadcrumb `مكتبة المعرفة ›`
- 🟡 Navy hero: type badge · filename · meta `النوع: PDF · ٤.٢٠ MB` · `تاريخ الرفع: ٢١ يونيو ٢٠٢٦` · `✦ اكتمل التحليل ١٠٠٪` · right stat `تأثير على Content DNA` `+8%` (gold)
- 🟡 Card `الملخص التنفيذي` (icon)
- 🟡 Card `أبرز الأفكار المستخرجة` — numbered square badges
- 🟡 Card `اقتباسات قوية` — quote rows w/ colored accent bars
- 🟡 Card `مشكلات الجمهور التي يحلّها` + helper `ما الذي يعالجه هذا المصدر لدى جمهورك:` → **quote chips**
- ⬜ Left rail card `فرص المحتوى` — 5 tinted rows w/ counts: بوستات تعليمية 10 · بوستات قصصية 5 · بوستات بيعية 3 · سكريبت ريلز 2 · كاروسيل 1
- ⬜ Left rail card `CTAs مقترحة`: احجز استشارة · حمّل الملف المجاني · اكتب كلمة «محتوى» · شارك تجربتك في التعليقات
- ⬜ Left rail navy action stack: `حوّل هذا الملف إلى بوستات` (teal) · `أنشئ حملة من هذا الملف` · `أضف إلى Content DNA` · `صدّر الملخص` (text)
- ⬜ Analyzing-state placeholder (progress, not empty blocks)

## 11) Content DNA — `بصمة المحتوى` (`/dna`)  [current: 🟡 basic]
- ⬜ Navy hero: gold pill `✦ بصمتك الفريدة` · H1 `بصمة المحتوى` · description · **radial `82%`** + caption `اكتمال`
- ⬜ Card `Voice Profile — ملف النبرة`: rows `النبرة` → `واثقة · تعليمية · عملية` · `اللغة` → `فصحى بسيطة بلمسة خليجية` · `أسلوب الشرح` → `خطوات واضحة + أمثلة عملية` · `طول الجمل` → 3-segment meter (teal) · `مستوى الجرأة` → 3-segment meter (amber)
- ⬜ Card `Audience Profile — ملف الجمهور`: `الجمهور الأساسي` · `مستوى الوعي` · `أكثر ما يهمهم:` chips (الانتشار · الثقة · البيع · اختصار الوقت)
- ⬜ Card `Hook Style — أسلوب الهوك`: 4 teal-dot rows (سؤال مباشر · خطأ شائع · اعتراف شخصي · مقارنة قبل/بعد)
- ⬜ Card `CTA Style — أسلوب الدعوة`: 4 amber-dot rows (CTA ناعم غير مباشر · دعوة للتعليق · دعوة لإرسال كلمة مفتاحية · دعوة لحجز استشارة)
- ⬜ Card `نقاط القوة` (✓ teal) — 4 mint rows
- ⬜ Card `فجوات تحتاج تحسين` (⚠ amber) — 4 cream rows
- ⬜ Section `ركائز المحتوى المقترحة` + sub `المزيج المثالي لمحتوى متوازن يبني التأثير ويبيع.` → 6 tinted pillar tiles w/ emoji + %: 📚 تعليمي 35% · 📖 قصصي 20% · 🏆 إثبات خبرة 15% · 💼 بيعي ناعم 12% · 💡 قيادة فكرية 10% · 💬 تفاعل 8% (must sum 100)
- ⬜ Action row: `تحديث بصمة المحتوى` (navy) · `إضافة عينات كتابة` · `جرّب كتابة بوست بأسلوبي` · `تحسين البصمة` (soft)

## 12) Content Studio — `الاستوديو` (`/studio`)  [current: 🟡 1-column]
**Rebuild as a 3-column workspace.**
- ⬜ Teal pill `✦ يكتب بأسلوبك — مطابقة بصمة ٨٨٪`
- ⬜ H1 `استوديو المحتوى` + sub `اكتب، ولّد، وحرّر محتواك بصوتك — ثم أرسله للاعتماد أو الجدولة.`
- ⬜ Header actions: `أرسل للاعتماد` (teal) · `جدولة` · `حفظ كمسودة`
- ⬜ **Right rail** card `المصدر`: type badge + `دورة بناء البراند الشخصي` + `٢٤ فكرة متاحة` + picker chevron
- ⬜ **Right rail** inspector: `المنصة` (LinkedIn · X / Twitter · Instagram) · `الصيغة` (بوست · سلسلة · كاروسيل · سكريبت ريلز) · `النبرة` + hint `من بصمتك` (قصصي · تعليمي · تحليلي · بيعي ناعم) · `الطول` (قصير · متوسط · طويل)
- ⬜ **Center** navy prompt bar: ph `اطلب من أثر... مثال: اكتب بوست عن أهمية التكرار في بناء البراند` + `ولّد` (teal) + ✦ button
- ⬜ **Center** card `اختر الهوك — ٣ بدائل بأسلوبك` + link `بدائل أخرى` → 3 radio rows w/ check-circle
- ⬜ **Center** editor toolbar: `أعد التوليد` (↺) · `أطِل` · `اختصر` · `أضف إيموجي` · `غيّر النبرة`
- ⬜ **Center** draft body (editable) + footer meta `١٤٢ كلمة · وقت قراءة ٤٥ ثانية` + `مطابقة البصمة ٨٨٪`
- ⬜ **Left rail** card `معاينة حيّة`: avatar + `أحمد العتيبي` + `مدرّب أعمال · الآن` + `in` glyph + body + `المزيد` + engagement row (👍 ٢٤٠ · 💬 ٣٢ · ♻️ ١٨)
- 🟡 **Left rail** card `Post Score` → **radial gauge** `92` + caption `توقّع تفاعل مرتفع — هوك قوي وطول مثالي.`
- 🟡 **Left rail** card `مطابقة بصمتك` → `88%` + bar + hint `النبرة والإيقاع قريبان من أسلوبك. جرّب جملة ختامية أقصر لرفع النسبة.`
- ⬜ **Left rail** best-time card: `أفضل وقت للنشر: الأحد ٩:٠٠ ص`

## 13) Ideas Bank — `بنك الأفكار` (`/ideas`)  [current: 🟡]
- 🟡 H1 `بنك الأفكار` + sub `أفكار لا تنضب، مبنية على خبرتك ومصادرك — جاهزة للتحويل إلى بوستات.`
- ⬜ CTA `✦ ولّد أفكارًا جديدة` (teal, top-left)
- 🟡 **Navy generator bar**: label `عن أي موضوع؟` + ph `مثال: التسعير للمستقلين، بناء الثقة، أخطاء المبتدئين...` + `توليد` (teal)
- 🟡 Filter chips → must be 5: الكل · مقترحة اليوم · من مصادرك · رائجة · محفوظة
- 🟡 3-col card grid → each card: **status pill** (جديدة/محفوظة/مستخدمة) · **emoji tile** (tinted) · title · **category chip** (تعليمي/قائمة/قصصي/إرشادي/تحليلي/جدلي) · **source line** `من: دورة بناء البراند` or `من: رائج في التسويق` · footer `Post Score 92` + **bookmark icon button** + navy `اكتب`

## 14) Calendar — `التقويم` (`/calendar`)  [current: 🟡]
- 🟡 H1 `التقويم` + sub `خطط وجدول نشرك عبر المنصات بنظرة واحدة.`
- ⬜ Segmented toggle `شهري` / `أسبوعي` + teal `+ جدولة منشور`
- ⬜ Right card `المنصات` legend: LinkedIn (blue) · X / Twitter (dark) · Instagram (amber)
- ⬜ Right card `غير مجدولة` + count badge `٣` → rows w/ title + `جدولة` button
- ⬜ Month header: `يوليو ٢٠٢٦` + ‹ › nav + pill `✦ أفضل أوقات النشر: الأحد والثلاثاء ٩ص`
- 🟡 Month grid: weekday row (السبت→الجمعة) · muted out-of-month days · today badge · **event chips w/ platform color bar + title + time** · 3-per-cell density
- ⬜ Weekly view

## 15) Approvals — `الموافقات` (`/approvals`)  [current: 🟡]
- 🟡 H1 `الموافقات` + sub `راجِع مسودات أثر واعتمدها قبل النشر — أو أعِدها للتحرير.`
- ⬜ **Navy banner**: `7 منشورًا بانتظار مراجعتك` + `اعتماد الكل`
- 🟡 Filter chips: بانتظار المراجعة · معتمد · تعديل مطلوب
- 🟡 Cards → two-pane: content pane (platform badge `in`/`X`/`ig` + `LinkedIn · الزاوية الفريدة` + timestamp `الأحد ٢٢ يونيو · ٩:٠٠ ص` + excerpt) | **action rail** (`88%` `بصمتك` | `92` `Post Score` + `اعتماد ونشر` teal + `تحرير` + `رفض`)
- ⬜ Empty state

## 16) Analytics — `التحليلات` (`/analytics`)  [current: 🟡 sample]
- ⬜ Date-range chips: `آخر ٧ أيام` · `آخر ٣٠ يوم` · `آخر ٣ أشهر`
- 🟡 4 KPI cards w/ **icon tiles + deltas**: `إجمالي الوصول` 48.2K +18% · `التفاعل` 3,940 +24% · `متابعون جدد` 620+ +9% · `معدل التفاعل` 5.8% **-0.4% (red)**
- 🟡 Card `التفاعل عبر الزمن` + trend pill `اتجاه صاعد ↗` → 6 bars (أسبوع ١..٦), latest gold+bold
- ⬜ Card `التفاعل حسب المنصة`: LinkedIn 58% (blue) · X / Twitter 27% (dark) · Instagram 15% (gold)
- ⬜ Card `أنواع المحتوى`: donut + legend 42% قصصي · 31% تعليمي · 16% تحليلي · 11% بيعي
- 🟡 Navy insight card `✦ ماذا ينجح` + body w/ emphasis + CTA `حدّث بصمتك بهذه الرؤى` → writes to DNA
- ⬜ Card `أفضل المنشورات أداءً`: ranked rows (1 gold chip) + title + `LinkedIn · وصول ١٢.٤ك · تفاعل ٨٩٠` + score `96`

## 17) Settings — `الإعدادات` (`/settings`)  [current: 🟡 5 tabs]
Tabs must be **6**: `الملف الشخصي` · `البراند والبصمة` · `المنصات` · `الفريق` · `الخطة والفوترة` · `الإشعارات`
- ⬜ Page sub `أدر حسابك، بصمتك، منصاتك، وخطتك.`
- **الملف الشخصي**: ⬜ avatar + `تغيير الصورة` + `JPG أو PNG · حتى ٢ ميجابايت` + fields `الاسم` / `المسمّى` (2-up) + `نبذة تعريفية` textarea + teal `حفظ التغييرات`
- **البراند والبصمة**: ⬜ ghost `فتح بصمة المحتوى` + 2×2 read-only tiles (نوع البراند · المجال · الجمهور · اللهجة) + green panel `اكتمال البصمة ٨٢٪` + `أضف ٣ عيّنات كتابة إضافية لرفع الدقة.` + navy `إضافة عيّنات`
- **المنصات** (NEW tab): ⬜ title `المنصات المربوطة` + sub `اربط حساباتك لتنشر مباشرة من أثر.` + 4 rows (LinkedIn `مربوط · أحمد العتيبي` + `فصل` · X `مربوط · @ahmad` + `فصل` · Instagram `غير مربوط` + `ربط` · TikTok `غير مربوط` + `ربط`)
- **الفريق**: 🟡 owner row (avatar + `أحمد العتيبي (أنت)` + `المالك · صلاحيات كاملة` + pill `مالك`) + dashed upsell (`ادعُ فريقك للتعاون` + body + gold `الترقية لخطة الوكالة`)
- **الخطة والفوترة**: 🟡 current panel (`خطتك الحالية` / `الخطة المجانية` + `ملفات المعرفة` bar + `٣ / ٥`) + 2 plan cards (`احترافي` 99 ريال/شهر + `ترقية` navy · `الوكالة` 299 ريال/شهر + badge + `ترقية` teal)
- **الإشعارات**: 🟡 4 rows w/ **title + description + switch**: اكتمال تحليل ملف (`تنبيه عند جاهزية الأفكار من ملف جديد`) · تذكير النشر المجدول (`قبل موعد نشر كل منشور بساعة`) · توصيات أثر الأسبوعية (`ملخّص أداء واقتراحات كل أحد`) · رسائل تسويقية (`أخبار المنتج والعروض`)

---

## Execution waves (single plan, ordered by dependency)

| Wave | Contents |
|---|---|
| **W0** | Design primitives (§0.3) + shell parity (sidebar nav/badge/plan CTA, header account chip) + numeral policy |
| **W1** | Auth trio: Sign Up (split out) · Login · Forgot password (two-column brand panels) |
| **W2** | Onboarding wizard 1→2→3 (replaces the current 1-step onboarding) |
| **W3** | Dashboard full parity |
| **W4** | Knowledge: Upload · Vault · File Analysis |
| **W5** | Content DNA full parity |
| **W6** | Studio 3-column rebuild (biggest single screen) |
| **W7** | Ideas Bank |
| **W8** | Ops: Calendar (+weekly view) · Approvals · Analytics |
| **W9** | Settings 6 tabs (incl. new المنصات tab) |
| **W10** | Empty/loading/error states pass + responsive (mobile) pass for all new screens |

**Out of scope for this plan (wiring later):** real OAuth, publishing, platform analytics data, billing/upgrade, team invites, background jobs.
