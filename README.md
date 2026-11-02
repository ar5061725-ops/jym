# متتبع النادي

تطبيق Next.js لتسجيل التمارين اليومية، مربوط بـ Supabase ومنشور على Vercel.

- الموقع: https://jym-five.vercel.app
- GitHub: https://github.com/ar5061725-ops/jym-
- Supabase: المشروع `ovmtnpbyorwlsuzmxcam`

## رؤية النسخة الجديدة

افتح الموقع المنشور https://jym-five.vercel.app، أو شغّل المشروع من هذا المجلد:

```bash
npm install
npm run dev
```

ثم افتح `http://localhost:3000`.

> هذا مشروع Next.js ولا يُفتح بالنقر المزدوج على ملف HTML.
> إذا ظهر تصميم قديم في الموقع، اضغط `Ctrl+Shift+R` لتحديث الصفحة.

## النشر

```bash
git add -A
git commit -m "update"
git push
npx vercel deploy --prod --yes
```

## ملاحظات

- الدخول بالاسم والرقم السري فقط (6 خانات على الأقل). لا يوجد استرجاع للرقم السري.
- الملف القديم `index_7.html` ما زال في مجلد التنزيلات.
- ملف `.env.local` فيه رابط Supabase ومفتاحه العام، ولا يُرفع إلى GitHub.
