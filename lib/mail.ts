import nodemailer from "nodemailer";
import { getDictionary, type Locale } from "./i18n";

// Envoi des e-mails de compte (vérification, mot de passe oublié) par SMTP,
// par exemple la boîte @cortege.me du pack IONOS. Sans configuration SMTP
// (développement local), le lien est seulement écrit dans la console.

type MailKind = "verify" | "reset" | "alreadyRegistered";

function transport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({
    host,
    port,
    // 465 : TLS direct ; 587 : STARTTLS.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
}

export async function sendAccountMail(kind: MailKind, to: string, link: string, locale: Locale): Promise<void> {
  const m = getDictionary(locale).auth.mail[kind];
  const text = `${m.body}\n\n${link}\n\n${m.footer}`;
  const t = transport();
  if (!t) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP non configuré : impossible d'envoyer l'e-mail");
    console.info(`[mail] (SMTP non configuré) ${kind} pour ${to} : ${link}`);
    return;
  }
  await t.sendMail({
    from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
    to,
    subject: m.subject,
    text,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1e2140">
<p>${escapeHtml(m.body)}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#1e2140;color:#fff;padding:10px 18px;border-radius:3px;text-decoration:none;font-weight:600">${escapeHtml(m.cta)}</a></p>
<p style="font-size:13px;color:#666">${escapeHtml(m.footer)}</p>
</div>`,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
