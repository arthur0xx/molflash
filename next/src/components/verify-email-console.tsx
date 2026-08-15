"use client";

import Link from "next/link";
import { CheckCircle2, MailCheck, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { refreshAuthSession, sendVerificationEmail, type AuthSession } from "@/lib/auth";

type PageState = "loading" | "ready" | "signed-out" | "verified";

export function VerifyEmailConsole() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<PageState>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [notice, setNotice] = useState(searchParams.get("sent") === "1" ? "أرسلنا رابط التفعيل إلى بريدك الإلكتروني." : "");
  const [sending, setSending] = useState(false);
  const nextPath = searchParams.get("next");
  const safeNext = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/account";

  useEffect(() => {
    let active = true;
    void refreshAuthSession().then((current) => {
      if (!active) return;
      setSession(current);
      if (!current) setState("signed-out");
      else if (current.emailVerified) setState("verified");
      else setState("ready");
    }).catch(() => { if (active) setState("signed-out"); });
    return () => { active = false; };
  }, []);

  async function resend() {
    setSending(true); setNotice("");
    const result = await sendVerificationEmail();
    setSending(false);
    if (result === "sent") { setNotice("تم إرسال رابط تفعيل جديد إلى بريدك الإلكتروني."); return; }
    if (result === "already-verified") { setState("verified"); return; }
    setNotice("تعذر إرسال الرابط الآن. تحقق من اتصالك ثم حاول لاحقًا.");
  }

  return <main className="auth-action-page"><section className="auth-action-card">
    {state === "loading" && <><span className="auth-action-icon"><MailCheck size={31}/></span><p className="eyebrow">ChriGsm</p><h1>جارٍ مراجعة حسابك…</h1><p>نحضّر خطوة تأكيد البريد الإلكتروني.</p></>}
    {state === "ready" && <><span className="auth-action-icon"><MailCheck size={31}/></span><p className="eyebrow">خطوة أخيرة</p><h1>فعّل بريدك الإلكتروني</h1><p>أرسلنا رابطًا إلى <b>{session?.email}</b>. افتح الرسالة ثم اضغط رابط التفعيل للمتابعة إلى حسابك.</p>{notice && <p className="success-note" role="status">{notice}</p>}<div className="auth-action-actions"><button className="primary-button" onClick={resend} disabled={sending}><RefreshCw size={16}/>{sending ? "جارٍ الإرسال..." : "إعادة إرسال الرابط"}</button><Link className="outline-button" href="/login">العودة إلى الدخول</Link></div></>}
    {state === "verified" && <><span className="auth-action-icon success"><CheckCircle2 size={31}/></span><p className="eyebrow">تم التأكيد</p><h1>بريدك الإلكتروني مفعّل</h1><p>يمكنك الآن متابعة استخدام حسابك بشكل كامل.</p><button className="primary-button" onClick={() => router.push(safeNext)}>متابعة إلى حسابي</button></>}
    {state === "signed-out" && <><span className="auth-action-icon error"><ShieldAlert size={31}/></span><p className="eyebrow">يلزم تسجيل الدخول</p><h1>لا يوجد حساب مفتوح</h1><p>سجّل الدخول أولًا، ثم سنساعدك على تأكيد بريدك الإلكتروني.</p><Link className="primary-button" href={`/login?next=${encodeURIComponent(safeNext)}`}>تسجيل الدخول</Link></>}
  </section></main>;
}
