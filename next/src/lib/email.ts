import "server-only";

import nodemailer from "nodemailer";

type AuthEmailKind = "verify" | "reset";

type AuthEmailInput = {
  to: string;
  actionUrl: string;
  kind: AuthEmailKind;
};

function smtpConfiguration() {
  const user = process.env.GMAIL_SMTP_USER?.trim();
  const password = process.env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s/g, "");
  const senderName = process.env.GMAIL_SMTP_SENDER_NAME?.trim() || "ChriGsm";
  if (!user || !password) return null;
  return { user, password, senderName };
}

export function gmailSmtpConfigured() {
  return Boolean(smtpConfiguration());
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character] || character);
}

function emailContent(kind: AuthEmailKind, actionUrl: string) {
  const isVerification = kind === "verify";
  const subject = isVerification ? "فعّل بريدك الإلكتروني في ChriGsm" : "أعد تعيين كلمة مرور ChriGsm";
  const heading = isVerification ? "أكّد بريدك الإلكتروني" : "إعادة تعيين كلمة المرور";
  const introduction = isVerification
    ? "مرحبًا، شكرًا لإنشاء حسابك في ChriGsm. أكّد بريدك الإلكتروني لتفعيل حسابك." 
    : "وردنا طلب لإعادة تعيين كلمة مرور حسابك في ChriGsm.";
  const actionLabel = isVerification ? "تفعيل البريد الإلكتروني" : "تعيين كلمة مرور جديدة";
  const ignoreNotice = isVerification
    ? "إذا لم تنشئ حسابًا في ChriGsm، يمكنك تجاهل هذه الرسالة بأمان."
    : "إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة بأمان؛ لن تتغير كلمة المرور.";
  const safeUrl = escapeHtml(actionUrl);

  return {
    subject,
    text: `${introduction}\n\n${actionLabel}: ${actionUrl}\n\n${ignoreNotice}\n\nفريق ChriGsm`,
    html: `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="margin:0;background:#f6f8fb;color:#172033;font-family:Arial,Helvetica,sans-serif;line-height:1.75">
    <main style="max-width:560px;margin:32px auto;padding:0 16px">
      <section style="overflow:hidden;background:#ffffff;border:1px solid #e5eaf2;border-radius:18px;box-shadow:0 12px 28px rgba(23,32,51,.08)">
        <header style="padding:26px 30px;background:#102a43;color:#ffffff"><p style="margin:0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.8">ChriGsm</p><h1 style="margin:8px 0 0;font-size:24px;line-height:1.35">${heading}</h1></header>
        <div style="padding:30px"><p style="margin:0 0 22px">${introduction}</p><p style="margin:0 0 25px;text-align:center"><a href="${safeUrl}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700">${actionLabel}</a></p><p style="margin:0 0 22px;font-size:13px;color:#526074">إن لم يعمل الزر، انسخ الرابط التالي وافتحه في المتصفح:</p><p style="margin:0 0 24px;word-break:break-all;font-size:12px"><a href="${safeUrl}" style="color:#0f766e">${safeUrl}</a></p><p style="margin:0;color:#526074;font-size:13px">${ignoreNotice}</p></div>
      </section>
      <p style="margin:16px 4px;color:#6b778a;font-size:12px;text-align:center">هذه رسالة تلقائية من ChriGsm. لا تشارك رابطك مع أي شخص.</p>
    </main>
  </body>
</html>`,
  };
}

export async function sendAuthEmail({ to, actionUrl, kind }: AuthEmailInput) {
  const config = smtpConfiguration();
  if (!config) throw new Error("SMTP_UNAVAILABLE");

  const parsedUrl = new URL(actionUrl);
  if (parsedUrl.protocol !== "https:") throw new Error("INVALID_ACTION_URL");

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: config.user, pass: config.password },
  });
  const content = emailContent(kind, parsedUrl.toString());
  const result = await transporter.sendMail({
    from: { name: config.senderName.replace(/[\r\n]/g, " "), address: config.user },
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  return result.messageId;
}
