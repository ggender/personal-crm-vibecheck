// The only home for the login letter. Locally it goes to Mailpit
// (docker-compose.yml): letters stay on this computer, http://localhost:8025.
import nodemailer from "nodemailer";
import { formatMinuteCount } from "@/features/contacts/format";
import { log } from "@/lib/log";
import { LOGIN_LINK_MINUTES } from "./validation";

const MAILPIT_SMTP_URL = "smtp://localhost:1025";
const FROM = "Личная CRM <no-reply@localhost>";

// Carries only the SMTP error code: the server's answer often names the
// recipient, and the address must not reach the log.
export class LoginEmailError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("The login email could not be sent");
    this.name = "LoginEmailError";
    this.code = code;
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildLoginEmail(url: string) {
  const lifetime = `Ссылка действует ${formatMinuteCount(LOGIN_LINK_MINUTES)} и срабатывает один раз.`;
  const notYou = "Если ты не просил войти — просто удали это письмо.";
  return {
    subject: "Вход в Личную CRM",
    text: [
      "Чтобы войти в Личную CRM, открой ссылку:",
      url,
      "",
      lifetime,
      notYou,
    ].join("\n"),
    html: [
      "<p>Чтобы войти в Личную CRM, нажми на ссылку:</p>",
      `<p><a href="${escapeHtml(url)}">Войти в Личную CRM</a></p>`,
      `<p>${lifetime}<br>${notYou}</p>`,
    ].join("\n"),
  };
}

export async function sendLoginEmail(to: string, url: string): Promise<void> {
  const transport = nodemailer.createTransport(
    process.env.CRM_SMTP_URL ?? MAILPIT_SMTP_URL,
  );
  try {
    await transport.sendMail({ from: FROM, to, ...buildLoginEmail(url) });
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    const failure = new LoginEmailError(
      typeof code === "string" ? code : "unknown",
    );
    log.error("auth", "login_link.send_failed", failure);
    throw failure;
  }
  log.info("auth", "login_link.sent");
}
