# ChriGsm Next + Firebase Rebuild

هذه نسخة إعادة البناء الجديدة لمتجر ChriGsm ولوحة CMC ومنطقة العميل. تعتمد Next.js للواجهة ومسارات الخادم، وتستعد للربط مع Firebase Authentication وFirestore وStorage. تعمل الواجهة ببيانات GSM تجريبية عندما لا توجد إعدادات Firebase، لذلك لا تتوقف المعاينة أثناء إعداد الحساب السحابي.

## التطوير والمعاينة الفورية

شغّل `npm run dev` ثم افتح `http://localhost:3000`. يدعم Next.js التحديث الفوري؛ أي تعديل محفوظ على ملف واجهة يظهر في المتصفح فورًا من دون إعادة build أو نشر. استخدم فرعًا مستقلًا لكل تغيير، وبعد دفعه إلى GitHub ينشئ Vercel رابط Preview لمراجعته قبل دمجه في `main`.

| الأمر | الغرض |
|---|---|
| `npm run dev` | معاينة حية محلية مع Hot Reload |
| `npm run build` | تحقق إنتاجي محلي |
| `npm run emulators` | تشغيل Firebase Auth/Firestore/Storage محليًا عند تثبيت Firebase CLI |
| `npm run seed:demo` | إدخال بيانات ChriGsm التجريبية إلى Firestore بعد ضبط Firebase Admin |
| `npm run clear:demo` | حذف الوثائق الموسومة `demo:true` فقط |

## إعداد Firebase لاحقًا

انسخ `.env.example` إلى `.env.local` وأضف قيم Web App العامة وقيم Firebase Admin الخادمية. لا ترفع `.env.local` أو مفتاح الخدمة إلى Git. بعد ذلك، انشر `firestore.rules` و`storage.rules` من Firebase CLI، ثم شغّل `npm run seed:demo`.

> لا تحذف البيانات يدويًا بهدف التنظيف. استخدم `npm run clear:demo` لأنه مصمم ليزيل البيانات التجريبية فقط، ولا يمس أي سجل لا يحمل الوسم `demo:true`.

## المسارات الحالية

| المسار | الوظيفة |
|---|---|
| `/` | الصفحة الرئيسية والتصنيفات والخدمات المميزة |
| `/catalog` | الكتالوج مع فلتر التصنيف |
| `/service/[slug]` | تفاصيل الخدمة والحقول الديناميكية للطلب |
| `/account` | منطقة العميل: الرصيد والطلبات والتسليم التجريبي |
| `/admin` | لوحة ChriGsm CMC التجريبية |

## قواعد الأمان

عمليات الرصيد والحالة والتسليم الحقيقية يجب أن تمر عبر Route Handlers خادمية بعد التحقق من دور المدير. لا تستخدم بيانات Firebase Admin داخل مكوّنات المتصفح أو متغيرات `NEXT_PUBLIC_`.
