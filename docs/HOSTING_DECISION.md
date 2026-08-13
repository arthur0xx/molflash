# قرار استضافة chrigsm

## البنية المقترحة

انشر واجهة React/Vite على **Vercel** من `frontend/`، وانشر خادم Express وSQLite على **Render Web Service** من `backend/` مع قرص دائم مركب على `/var/data`. اضبط `DATABASE_PATH=/var/data/store.db` في الخادم، ثم اضبط `VITE_API_BASE_URL` في Vercel إلى رابط خادم Render النهائي من دون اللاحقة `/api`، واضبط `CORS_ORIGIN` في Render إلى رابط Vercel النهائي.

## السبب

قاعدة SQLite تكتب ملفاً محلياً. توثيق Render يوضح أن نظام الملفات الافتراضي مؤقت، وأن فقط الملفات تحت مسار القرص المركب تبقى عبر إعادة النشر وإعادة التشغيل. كما يوضح أن Render Web Services يدعم Node.js وExpress، ويربط المنفذ من المتغير `PORT`، ويمكنه الربط بمستودع GitHub والتحديث مع الدفع إلى الفرع. لذلك لا يجب نشر قاعدة SQLite الحالية داخل وظيفة Vercel/Netlify عديمة الحالة وحدها.

القرص الدائم متاح لخدمات Render المدفوعة، ولا يمكن توسيع خدمة مرتبطة بقرص إلى نسخ متعددة. احتفظ بنسخة واحدة من خادم SQLite، وخذ نسخاً احتياطية للملف قبل التحديثات المهمة.

## إعداد Render المقترح

| الحقل | القيمة |
|---|---|
| نوع الخدمة | Web Service / Node |
| الجذر | `backend` |
| أمر البناء | `npm ci` |
| أمر البدء | `npm start` |
| Health check | `/api/health` |
| مسار القرص | `/var/data` |
| مسار قاعدة البيانات | `/var/data/store.db` |
| متغيرات مطلوبة | `NODE_ENV=production`, `JWT_SECRET`, `CORS_ORIGIN`, `DATABASE_PATH=/var/data/store.db` |

## إعداد Vercel المقترح

| الحقل | القيمة |
|---|---|
| المستودع | `arthur0xx/molflash` |
| الجذر | `frontend` |
| إطار العمل | Vite |
| أمر البناء | `npm run build` |
| مجلد الخرج | `dist` |
| متغير مطلوب | `VITE_API_BASE_URL=https://<render-service>.onrender.com` |

## المصادر

- [Render Persistent Disks](https://render.com/docs/disks)
- [Render Blueprint YAML Reference](https://render.com/docs/blueprint-spec)
- [Render Web Services](https://render.com/docs/web-services)
- [Vercel Functions Documentation Search](https://vercel.com/docs/functions)
