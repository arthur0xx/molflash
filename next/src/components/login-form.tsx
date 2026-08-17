"use client";

import Link from "next/link";
import { ArrowLeft, Check, LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeGoogleRedirect, registerCustomer, requestPasswordReset, signIn, signInWithGoogle } from "@/lib/auth";

const resetConfirmation = "إذا كان البريد مرتبطًا بحساب ChriGsm، ستصلك رسالة لإعادة تعيين كلمة المرور.";
type LoginMode = "signin" | "signup" | "reset";

const modeContent: Record<LoginMode, { label: string; title: string; intro: string }> = {
  signin: {
    label: "دخول العميل",
    title: "أكمل من حيث توقفت",
    intro: "ادخل إلى طلباتك، رصيدك، ورسائل الدعم من حساب واحد.",
  },
  signup: {
    label: "حساب جديد",
    title: "ابدأ بحساب واضح وبسيط",
    intro: "أنشئ حسابك ثم أكّد بريدك لتتمكن من إرسال الطلبات ومتابعتها.",
  },
  reset: {
    label: "استعادة الوصول",
    title: "استعد دخولك بأمان",
    intro: "سنرسل رابطًا آمنًا إلى البريد الإلكتروني المرتبط بالحساب.",
  },
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [mode, setMode] = useState<LoginMode>("signin");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  const [submittingReset, setSubmittingReset] = useState(false);
  const [submittingSignup, setSubmittingSignup] = useState(false);

  const safeNext = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/account";
  const verificationPath = `/verify-email?next=${encodeURIComponent(safeNext)}`;
  const content = modeContent[mode];

  useEffect(() => {
    let cancelled = false;
    void completeGoogleRedirect().then(async (result) => {
      if (cancelled || !result) return;
      if (result.status !== "signed-in") {
        const message = result.status === "existing-account"
          ? "هذا البريد مرتبط بحساب ChriGsm بالبريد وكلمة المرور. سجّل الدخول بالبريد أولًا، ثم اربط Google من إعدادات الحساب."
          : result.errorCode === "auth/unauthorized-domain"
            ? "نطاق الموقع غير مضاف في Firebase Authorized Domains."
            : result.errorCode?.startsWith("register-")
              ? "تمت مصادقة Google، لكن تعذر إعداد ملف الحساب. حاول مرة أخرى أو تواصل مع الدعم."
              : "تعذر إكمال تسجيل الدخول عبر Google. حاول مرة أخرى.";
        setError(message);
        return;
      }
      const { refreshAuthSession } = await import("@/lib/auth");
      const session = await refreshAuthSession();
      if (cancelled || !session) return;
      if (session.role === "customer" && result.needsPhoneVerification) {
        router.replace(`/phone-verification?next=${encodeURIComponent(safeNext)}&first=1`);
        return;
      }
      router.replace(session.role === "admin" || session.role === "manager" ? "/admin" : safeNext);
    });
    return () => { cancelled = true; };
  }, [router, safeNext]);

  function setActiveMode(nextMode: LoginMode) {
    setMode(nextMode);
    setError("");
    setResetMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const session = await signIn(email, password);
    setSubmitting(false);
    if (!session) {
      setError("تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.");
      return;
    }
    if (session.role === "customer" && !session.emailVerified) {
      router.push(verificationPath);
      return;
    }
    router.push(session.role === "admin" || session.role === "manager" ? "/admin" : safeNext);
  }

  async function submitGoogle() {
    setSubmittingGoogle(true);
    setError("");
    const result = await signInWithGoogle();
    setSubmittingGoogle(false);
    if (result.status === "redirecting") return;
    if (result.status === "existing-account") {
      setError("هذا البريد مرتبط بطريقة دخول أخرى. سجّل الدخول بالبريد وكلمة المرور أولًا، ثم اربط Google من إعدادات الحساب.");
      return;
    }
    if (result.status !== "signed-in") {
      const errorMessage = result.errorCode === "auth/unauthorized-domain"
        ? "نطاق الموقع غير مضاف في Firebase Authorized Domains."
        : result.errorCode?.startsWith("register-")
          ? "تم تسجيل Google لكن تعذر إنشاء ملف الحساب. تحقق من إعداد Firebase Admin."
          : "تعذر تسجيل الدخول عبر Google حاليًا. حاول مرة أخرى.";
      setError(errorMessage);
      return;
    }
    const { refreshAuthSession } = await import("@/lib/auth");
    const session = await refreshAuthSession();
    if (!session) {
      setError("تعذر فتح جلسة الحساب بعد تسجيل الدخول عبر Google.");
      return;
    }
    if (session.role === "customer" && result.needsPhoneVerification) {
      router.push(`/phone-verification?next=${encodeURIComponent(safeNext)}&first=1`);
      return;
    }
    router.push(session.role === "admin" || session.role === "manager" ? "/admin" : safeNext);
  }

  async function submitSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setSubmittingSignup(true);
    setError("");
    const result = await registerCustomer(fullName, phone, email, password);
    setSubmittingSignup(false);
    if (result === "created") {
      router.push(`${verificationPath}&sent=1`);
      return;
    }
    if (result === "verification-unavailable") {
      router.push(`${verificationPath}&send=retry`);
      return;
    }
    if (result === "email-in-use") {
      setError("هذا البريد مرتبط بحساب موجود. سجّل الدخول أو استعد كلمة المرور.");
      return;
    }
    if (result === "weak-password") {
      setError("استخدم اسمًا صحيحًا وكلمة مرور من 8 أحرف على الأقل.");
      return;
    }
    if (result === "invalid-email") {
      setError("أدخل بريدًا إلكترونيًا صالحًا.");
      return;
    }
    setError("تعذر إنشاء الحساب حاليًا. حاول مرة أخرى لاحقًا.");
  }

  async function submitReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingReset(true);
    setError("");
    setResetMessage("");
    const result = await requestPasswordReset(email);
    setSubmittingReset(false);
    if (result === "sent") {
      setResetMessage(resetConfirmation);
      return;
    }
    if (result === "invalid-email") {
      setError("أدخل بريدًا إلكترونيًا صالحًا.");
      return;
    }
    setError("استعادة كلمة المرور غير متاحة حاليًا. تحقق من اتصالك ثم حاول لاحقًا.");
  }

  return (
    <main className="auth-shell">
      <section className="auth-context" aria-label="مزايا حساب ChriGsm">
        <p className="eyebrow">حساب ChriGsm</p>
        <h1>خدماتك وطلباتك في مكان واحد.</h1>
        <p>حساب واضح لمتابعة الطلبات، الرصيد، والتواصل مع الدعم عند الحاجة.</p>
        <ul className="auth-context-list">
          <li><span><Check size={15} aria-hidden="true" /></span> متابعة حالة كل طلب</li>
          <li><span><Check size={15} aria-hidden="true" /></span> إشعارات وتحديثات من الفريق</li>
          <li><span><Check size={15} aria-hidden="true" /></span> استعادة آمنة للدخول</li>
        </ul>
        <Link className="auth-catalog-link" href="/catalog">تصفح الخدمات <ArrowLeft size={16} aria-hidden="true" /></Link>
      </section>

      <section className="auth-form-surface" aria-labelledby="auth-title">
        <div className="auth-form-heading">
          <p className="auth-mode-label">{content.label}</p>
          <h2 id="auth-title">{content.title}</h2>
          <p>{content.intro}</p>
        </div>

        <div className="auth-mode-switch" role="tablist" aria-label="اختيار إجراء الحساب">
          <button className={mode === "signin" ? "active" : ""} type="button" role="tab" aria-selected={mode === "signin"} onClick={() => setActiveMode("signin")}>دخول</button>
          <button className={mode === "signup" ? "active" : ""} type="button" role="tab" aria-selected={mode === "signup"} onClick={() => setActiveMode("signup")}>حساب جديد</button>
        </div>
        {mode === "signup" && <aside className="auth-signup-flow" aria-label="مراحل استخدام الحساب الجديد"><span><b>1</b> أنشئ الحساب</span><i aria-hidden="true"/><span><b>2</b> أكّد البريد</span><i aria-hidden="true"/><span><b>3</b> اطلب وتابع</span></aside>}

        {mode === "signin" && <>
          <form className="auth-form" onSubmit={submit}>
            <label><span>البريد الإلكتروني</span><div className="auth-field"><Mail size={18} aria-hidden="true" /><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" type="email" autoComplete="username" required /></div></label>
            <label><span>كلمة المرور</span><div className="auth-field"><LockKeyhole size={18} aria-hidden="true" /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="أدخل كلمة المرور" type="password" autoComplete="current-password" required /></div></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" disabled={submitting || submittingGoogle} type="submit">{submitting ? "جارٍ التحقق..." : <>تسجيل الدخول <ArrowLeft size={17} aria-hidden="true" /></>}</button>
          </form>
          <div className="auth-divider"><span>أو</span></div>
          <button className="google-signin-button" type="button" onClick={() => { void submitGoogle(); }} disabled={submitting || submittingGoogle}><span className="google-mark" aria-hidden="true">G</span>{submittingGoogle ? "جارٍ فتح Google..." : "المتابعة عبر Google"}</button>
          <p className="auth-field-note">إذا استخدمت Google للمرة الأولى، سيُنشأ ملف حسابك تلقائيًا.</p>
          <button className="auth-text-action" type="button" onClick={() => setActiveMode("reset")}>نسيت كلمة المرور؟</button>
        </>}

        {mode === "signup" && <form className="auth-form" onSubmit={submitSignup}>
          <label><span>الاسم الكامل</span><div className="auth-field"><UserRound size={18} aria-hidden="true" /><input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="الاسم الذي سيظهر في حسابك" type="text" autoComplete="name" minLength={2} maxLength={80} required /></div></label>
          <label><span>رقم الهاتف <small>اختياري</small></span><div className="auth-field"><Phone size={18} aria-hidden="true" /><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="06XXXXXXXX" type="tel" autoComplete="tel" maxLength={32} /></div></label>
          <label><span>البريد الإلكتروني</span><div className="auth-field"><Mail size={18} aria-hidden="true" /><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" type="email" autoComplete="email" required /></div></label>
          <label><span>كلمة المرور</span><div className="auth-field"><LockKeyhole size={18} aria-hidden="true" /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 أحرف على الأقل" type="password" autoComplete="new-password" minLength={8} required /></div></label>
          <label><span>تأكيد كلمة المرور</span><div className="auth-field"><LockKeyhole size={18} aria-hidden="true" /><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="أعد كتابة كلمة المرور" type="password" autoComplete="new-password" minLength={8} required /></div></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" disabled={submittingSignup} type="submit">{submittingSignup ? "جارٍ إنشاء الحساب..." : <>إنشاء الحساب <ArrowLeft size={17} aria-hidden="true" /></>}</button>
          <p className="auth-field-note"><ShieldCheck size={15} aria-hidden="true" /> ستحتاج إلى تأكيد البريد قبل إرسال الطلب الأول.</p>
        </form>}

        {mode === "reset" && <form className="auth-form" onSubmit={submitReset}>
          <label><span>البريد الإلكتروني</span><div className="auth-field"><Mail size={18} aria-hidden="true" /><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" type="email" autoComplete="email" required autoFocus /></div></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {resetMessage && <p className="success-note" role="status">{resetMessage}</p>}
          <button className="primary-button auth-submit" disabled={submittingReset} type="submit">{submittingReset ? "جارٍ الإرسال..." : "إرسال رابط الاستعادة"}</button>
          <button className="auth-text-action" type="button" onClick={() => setActiveMode("signin")}>العودة إلى تسجيل الدخول</button>
        </form>}

        <p className="auth-privacy-note">لا تشارك كلمة المرور أو رموز التحقق مع أي شخص.</p>
      </section>
    </main>
  );
}
