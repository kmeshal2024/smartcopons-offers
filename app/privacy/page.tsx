import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'سياسة الخصوصية',
  description:
    'سياسة خصوصية سمارت كوبونز — ما نجمعه، وكيف نستخدمه، وحقوقك. لا نطلب حساباً ولا بيانات دفع.',
  alternates: { canonical: 'https://sa.smartcopons.com/privacy' },
}

// Dynamic like the other DB-backed pages: the shared Footer queries retailers,
// and Neon auto-suspends, so a build landing during a suspend can't prerender.
export const dynamic = 'force-dynamic'

// Required by Google Play and Huawei AppGallery, and it must describe what the
// app ACTUALLY does — an anonymous device id, a shopping list, and analytics.
export default function PrivacyPage() {
  const updated = '26 يوليو 2026'

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-pink-600 transition">الرئيسية</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-semibold">سياسة الخصوصية</span>
        </nav>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">سياسة الخصوصية</h1>
          <p className="text-xs text-gray-400 mb-6">آخر تحديث: {updated}</p>

          <div className="space-y-6 text-sm leading-relaxed text-gray-700">
            <section>
              <p>
                تشرح هذه السياسة ما تجمعه منصة <strong>سمارت كوبونز</strong> (الموقع
                sa.smartcopons.com وتطبيق الجوال) وكيف نستخدمه. باستخدامك المنصة فإنك توافق على ما
                ورد هنا.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">لا نطلب حساباً ولا بيانات شخصية</h2>
              <p>
                لا يتطلب استخدام سمارت كوبونز التسجيل أو تسجيل الدخول. <strong>لا نجمع</strong> الاسم
                أو البريد الإلكتروني أو رقم الجوال أو العنوان أو أي بيانات دفع، ولا نطلب صلاحيات
                الكاميرا أو جهات الاتصال أو الموقع الجغرافي.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">ما الذي نخزّنه فعلاً</h2>
              <ul className="list-disc pr-5 space-y-2">
                <li>
                  <strong>مُعرّف جهاز مجهول:</strong> رقم عشوائي يُنشأ في متصفحك/تطبيقك لحفظ
                  <strong> المفضّلة</strong> و<strong>متابعة الأسعار</strong>. هذا المعرّف لا يرتبط
                  بهويتك ولا يمكننا من معرفة من أنت.
                </li>
                <li>
                  <strong>قائمة التسوّق وعمليات البحث السابقة:</strong> تُحفظ داخل جهازك فقط
                  (Local Storage) ولا تُرسل إلى خوادمنا.
                </li>
                <li>
                  <strong>بيانات استخدام مجمّعة:</strong> عدد مشاهدات المنتجات وإحصاءات زيارة عامة،
                  لتحسين ترتيب العروض والأداء.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">أدوات التحليل</h2>
              <p>
                نستخدم <strong>Google Analytics</strong> لفهم كيفية استخدام المنصة بشكل إجمالي
                (الصفحات الأكثر زيارة، نوع الجهاز، مصدر الزيارة). قد تضع هذه الأداة ملفات تعريف
                ارتباط أو معرّفات مشابهة. البيانات مجمّعة ولا تُستخدم لتحديد هويتك.
                يمكنك الاطلاع على{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:underline"
                >
                  سياسة خصوصية Google
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">روابط المتاجر الخارجية</h2>
              <p>
                نعرض عروضاً وكوبونات من متاجر خارجية (بنده، كارفور، التميمي، لولو، النهدي، الدواء،
                وغيرها). عند الضغط على عرض أو كوبون قد تنتقل إلى موقع المتجر، وعندها تسري سياسة
                خصوصية ذلك المتجر لا سياستنا. الأسعار والعروض مملوكة لأصحابها ونعرضها للمقارنة فقط.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">مشاركة البيانات</h2>
              <p>
                لا نبيع بياناتك ولا نؤجّرها ولا نشاركها لأغراض تسويقية. نستعين بمزوّدي خدمة تقنيين
                لتشغيل المنصة (الاستضافة وقاعدة البيانات وأدوات التحليل) ضمن ما يلزم لتشغيلها فقط.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">حقوقك</h2>
              <p>
                يمكنك في أي وقت حذف مفضّلتك ومتابعاتك من داخل التطبيق، أو مسح بيانات
                التطبيق/المتصفح — وبذلك يُحذف مُعرّف الجهاز المجهول وتُفقد المفضّلة المرتبطة به. كما
                يمكنك مراسلتنا لطلب حذف أي بيانات مرتبطة بمعرّف جهازك.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">خصوصية الأطفال</h2>
              <p>
                المنصة موجّهة للجمهور العام ولا نجمع عن قصد أي بيانات من الأطفال دون سن 13 عاماً.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">التعديلات</h2>
              <p>
                قد نحدّث هذه السياسة، وسيظهر تاريخ آخر تحديث أعلى الصفحة. استمرارك في استخدام
                المنصة بعد التحديث يعني موافقتك على النسخة المحدّثة.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">التواصل</h2>
              <p>
                لأي استفسار بخصوص الخصوصية:{' '}
                <a href="mailto:mk2018ksa@gmail.com" className="text-pink-600 hover:underline">
                  mk2018ksa@gmail.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
