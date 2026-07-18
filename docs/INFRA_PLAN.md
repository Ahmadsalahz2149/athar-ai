# Athar AI — خطة البنية التحتية الاحترافية (Infrastructure Hardening)

الهدف: بنية تحتية **قوية، محكمة، مرتّبة** — كل زر يعمل باحترافية وبلا أخطاء، والعمليات
الطويلة لا تكسر مهلة الطلب، وكل فشل يُعالَج ويُعاد المحاولة عليه. مبنية على قراءة
المعمارية الفعلية (server actions متزامنة · لا نظام مهام · معالجة الرفع/التحليل داخل الطلب).

## المشكلة الجذرية الحالية

| العلّة | الأثر |
|---|---|
| الرفع/التحليل يجري **متزامنًا داخل server action** (transcribe → chunk → embed → store) | ملف صوتي/فيديو طويل ⇒ مخاطرة **مهلة الطلب** (timeout) وفشل صامت |
| لا نظام مهام (queue/worker) | لا إعادة محاولة · لا تقدّم حقيقي · لا استئناف بعد الفشل |
| «قيد التحليل» حالة وهمية | المستخدم لا يرى تقدّمًا فعليًا |
| التوليد بلا بثّ (no streaming) | انتظار صامت للمخرجات الطويلة |
| لا حدود أخطاء عامة (error boundaries) ولا نظام توست موحّد | خطأ واحد قد يُسقط الشاشة |

---

## الخريطة على مراحل

| المرحلة | العنوان | يسلّم | تدخّل منك؟ | الحالة |
|---|---|---|---|---|
| **١** | طبقة المهام الخلفية (Job Queue) | جدول `jobs` + `lib/jobs` (enqueue/claim SKIP LOCKED/complete/fail+backoff/progress) + worker route + سجلّ handlers + اختبارات | لا | **✅ تمّت** |
| **٢** | نقل المعالجة الطويلة للمهام | الرفع/التحليل يُنشئ مصدرًا `processing` + يُدرج مهمة ويعود فورًا؛ handler ينفّذ transcribe→chunk→embed→store بتقدّم مُقطّع؛ تشغيل عبر `after()` + احتياطي نبض العميل | لا | مخطّطة |
| **٣** | حالة حيّة في الواجهة (Realtime status) | `/api/jobs/status` + الرفع/الخزنة/الرئيسية تقرأ تقدّم المهمة الحقيقي؛ «قيد التحليل» حيّة | لا | مخطّطة |
| **٤** | البثّ المباشر للتوليد (Streaming) | مسار توليد يبثّ (SSE/ReadableStream) عبر Anthropic stream؛ الاستوديو يعرض التوليد لحظيًّا | لا | مخطّطة |
| **٥** | تصليب الأخطاء والمرونة (Resilience) | error boundary + not-found عام · نظام توست موحّد · أخطاء مُصنّفة لكل action · مفاتيح idempotency على الخصم/الإدراج · dead-letter للمهام · حارس معدّل | لا | مخطّطة |
| **٦** | المراقبة (Observability) | مسجّل مُهيكل + request-id · `/api/health` · لوحة عدّادات المهام | لا | مخطّطة |
| **٧** | التكاملات الخارجية | مشغّل cron دائم للـworker · SMTP فعلي للرسائل · OAuth منصّات للنشر الحقيقي · «مصدر كل سمة» | **نعم — مؤجّلة للنهاية** | مؤجّلة |

> كل ما يحتاج تدخّلك (مفاتيح، تسجيل تطبيقات، إعداد نشر/جدولة) مُجمّع في **المرحلة ٧**
> فقط، حتى تمضي المراحل ١–٦ كاملةً بلا توقّف.

---

## تفاصيل المرحلة ١ (الجاري الآن)

**جدول `jobs`** (tenancy-scoped، مُفهرس على الحالة):
`id · org_id · brand_id · type · status(queued|running|done|failed|dead) · payload(jsonb) ·
progress(0–100) · phase(text) · attempts · max_attempts · last_error · result(jsonb) ·
locked_at · locked_by · run_after · created_at · updated_at`

**`lib/jobs/queue.ts`** — واجهة آمنة:
- `enqueue(type, payload, {orgId, brandId, maxAttempts})` → jobId
- `claimNext(workerId)` → مهمة واحدة عبر `FOR UPDATE SKIP LOCKED` (لا تسابق)
- `setProgress(jobId, pct, phase)`
- `complete(jobId, result)` · `fail(jobId, error)` مع backoff أُسّي + dead-letter بعد `max_attempts`

**`lib/jobs/runner.ts`** — سجلّ `type → handler`؛ يشغّل، يُحدّث التقدّم، يلتقط الأخطاء.

**`app/api/worker/route.ts`** — `POST` يستدعي `claimNext` ويشغّل (idempotent، محمي برمز `WORKER_SECRET` اختياري).

**اختبارات** — enqueue/claim/complete/fail + عدم التسابق (SKIP LOCKED) + tenancy.

المعيار: `tsc` نظيف · lint 0 أخطاء · اختبارات خضراء · migration مُطبّقة.

**✅ نتيجة المرحلة ١:** الجدول مُطبّق (migration `0011`)؛ `lib/jobs/{types,queue,runner,handlers}`؛
`enqueueJob/getJob/activeJobs` (org-scoped) في `forOrg`؛ مسار `/api/worker` (يستجيب 200،
يستنزف دفعة + يستعيد المهام العالقة)؛ **٦ اختبارات خضراء** تشمل عدم التسابق (SKIP LOCKED)،
إعادة المحاولة + backoff + dead-letter، وعزل المستأجرين. المجموع: ٤٢ اختبارًا يمرّ.
