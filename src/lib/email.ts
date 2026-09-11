import "server-only";

/**
 * Outbound email abstraction. If RESEND_API_KEY/EMAIL_FROM aren't
 * configured, emails are logged to the server console instead of sent —
 * that's enough to develop and demo the verification/reset flows locally
 * without an email provider account. Swap `send()` for a real provider
 * (Resend, Postmark, SES...) in production; nothing else in the codebase
 * needs to change since callers only depend on this one function.
 */
interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.log(`\n[email:dev-mode] would send to=${to} subject="${subject}"\n${html}\n`);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
}

export function verificationEmailHtml(verifyUrl: string): string {
  return `<p>Confirm your AuthForge account by visiting the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`;
}

export function passwordResetEmailHtml(resetUrl: string): string {
  return `<p>We received a request to reset your AuthForge password.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`;
}
