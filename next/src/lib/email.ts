import "server-only";

import nodemailer from "nodemailer";

type AuthEmailKind = "verify" | "reset";

type AuthEmailInput = {
  to: string;
  actionUrl: string;
  kind: AuthEmailKind;
};

type EmailCopy = {
  subject: string;
  preview: string;
  eyebrow: string;
  heading: string;
  introduction: string;
  actionLabel: string;
  securityNote: string;
  ignoreNotice: string;
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

function emailCopy(kind: AuthEmailKind): EmailCopy {
  if (kind === "verify") {
    return {
      subject: "ChriGsm | فعّل بريدك الإلكتروني",
      preview: "خطوة واحدة لتفعيل حسابك والوصول إليه بأمان.",
      eyebrow: "تفعيل الحساب",
      heading: "أكّد بريدك الإلكتروني",
      introduction: "شكرًا لانضمامك إلى ChriGsm. أكّد بريدك الإلكتروني الآن حتى يصبح حسابك جاهزًا للاستخدام.",
      actionLabel: "تفعيل البريد الإلكتروني",
      securityNote: "لن نطلب منك كلمة المرور عبر البريد الإلكتروني. استخدم الزر أدناه فقط إذا أنشأت هذا الحساب.",
      ignoreNotice: "إن لم تنشئ حسابًا في ChriGsm، يمكنك تجاهل هذه الرسالة بأمان.",
    };
  }

  return {
    subject: "ChriGsm | أعد تعيين كلمة مرورك",
    preview: "استخدم هذا الرابط الآمن لاختيار كلمة مرور جديدة لحسابك.",
    eyebrow: "حماية الحساب",
    heading: "إعادة تعيين كلمة المرور",
    introduction: "تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك. اختر كلمة مرور جديدة وآمنة من خلال الزر أدناه.",
    actionLabel: "تعيين كلمة مرور جديدة",
    securityNote: "لم نغيّر أي شيء في حسابك. لا تشارك هذا الزر أو الرسالة مع أي شخص.",
    ignoreNotice: "إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة ولن تتغير كلمة المرور.",
  };
}

function emailContent(kind: AuthEmailKind, actionUrl: string) {
  const copy = emailCopy(kind);
  const safeUrl = escapeHtml(actionUrl);
  const safeButtonLabel = escapeHtml(copy.actionLabel);

  return {
    subject: copy.subject,
    text: `${copy.preview}\n\n${copy.introduction}\n\n${copy.actionLabel}: ${actionUrl}\n\n${copy.securityNote}\n\n${copy.ignoreNotice}\n\nفريق ChriGsm`,
    html: `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(copy.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fb;color:#1d2939;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;text-size-adjust:100%;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0;padding:0;background:#f4f7fb;">
      <tr>
        <td align="center" style="padding:28px 14px 34px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;margin:0 auto;">
            <tr>
              <td style="padding:0 22px 14px;text-align:center;">
                <span style="display:inline-block;border:1px solid #d8e2ef;border-radius:999px;background:#ffffff;color:#30445d;font-size:12px;font-weight:700;letter-spacing:.08em;padding:7px 14px;">CHRI<span style="color:#0f766e;">GSM</span></span>
              </td>
            </tr>
            <tr>
              <td style="overflow:hidden;border:1px solid #dfe7f1;border-radius:22px;background:#ffffff;box-shadow:0 12px 32px rgba(38,55,77,.10);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:32px 32px 30px;background:#102a43;background:linear-gradient(135deg,#0f253c 0%,#183f58 100%);color:#ffffff;text-align:right;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="width:58px;vertical-align:middle;padding-left:13px;"><table role="presentation" width="54" height="54" cellspacing="0" cellpadding="0" border="0" style="width:54px;height:54px;border:1px solid #1b5480;border-radius:15px;background:#082c58;"><tr><td align="center" valign="middle" style="height:54px;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-.08em;line-height:1;font-family:Arial,Helvetica,sans-serif;"><span style="color:#2196ff;">C</span><span style="color:#27d5d2;">G</span></td></tr></table></td>
                          <td style="vertical-align:middle;text-align:right;" dir="rtl">
                            <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0;color:#c0dedc;">${escapeHtml(copy.eyebrow)}</p>
                            <p style="margin:0;font-size:22px;font-weight:800;line-height:1.2;letter-spacing:.01em;">ChriGsm</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:34px 32px 12px;text-align:right;">
                      <p style="margin:0 0 13px;color:#0f766e;font-size:13px;font-weight:700;">${escapeHtml(copy.preview)}</p>
                      <h1 style="margin:0 0 16px;color:#172b42;font-size:27px;line-height:1.42;font-weight:800;">${escapeHtml(copy.heading)}</h1>
                      <p style="margin:0;color:#526477;font-size:16px;line-height:1.9;">${escapeHtml(copy.introduction)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:25px 32px 27px;">
                      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" aria-label="${safeButtonLabel}" style="display:inline-block;border-radius:11px;background:#0f766e;color:#ffffff;font-size:16px;font-weight:700;line-height:1;text-decoration:none;padding:16px 26px;box-shadow:0 8px 18px rgba(15,118,110,.22);">${safeButtonLabel}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 31px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #dcebe9;border-radius:12px;background:#f3faf9;">
                        <tr>
                          <td style="padding:14px 16px;color:#3e5d62;font-size:13px;line-height:1.75;text-align:right;">${escapeHtml(copy.securityNote)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-top:1px solid #e7edf4;padding:18px 32px 22px;color:#708094;font-size:12px;line-height:1.75;text-align:right;">${escapeHtml(copy.ignoreNotice)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px 0;color:#8090a3;font-size:12px;line-height:1.75;text-align:center;">هذه رسالة تلقائية من ChriGsm لحماية حسابك. نستخدمها فقط للعمليات التي طلبتها.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
    tls: { minVersion: "TLSv1.2" },
  });
  const content = emailContent(kind, parsedUrl.toString());
  const result = await transporter.sendMail({
    from: { name: config.senderName.replace(/[\r\n]/g, " "), address: config.user },
    replyTo: config.user,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  return result.messageId;
}
