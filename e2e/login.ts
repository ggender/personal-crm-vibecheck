import { expect, type Page } from "@playwright/test";

// Signing in the way a person does: the login form, then the letter in
// Mailpit (docker-compose.yml), then the link from it.

// The seed gives the 999 fictional contacts to this account
// (DEMO_EMAIL in src/db/seed-database.ts).
export const DEMO_EMAIL = "demo@example.com";

// Where the demo session is kept between scenarios (auth.setup.ts).
export const DEMO_STATE = "e2e/.auth/demo.json";

const MAILPIT_API = "http://localhost:8025/api/v1";

type MailpitMessage = { ID: string; Created: string };

// The newest letter to this address that arrived after `since`.
async function newestLetterText(
  email: string,
  since: Date,
): Promise<string | null> {
  const query = encodeURIComponent(`to:"${email}"`);
  const found = (await (
    await fetch(`${MAILPIT_API}/search?query=${query}&limit=1`)
  ).json()) as { messages: MailpitMessage[] };
  const [letter] = found.messages;
  if (!letter || new Date(letter.Created) < since) {
    return null;
  }
  const message = (await (
    await fetch(`${MAILPIT_API}/message/${letter.ID}`)
  ).json()) as { Text: string };
  return message.Text;
}

// Fills the login form and returns the link from the letter.
export async function requestLoginLink(
  page: Page,
  email: string,
): Promise<string> {
  // Mailpit keeps its own time; a little slack covers clock differences.
  const since = new Date(Date.now() - 1000);
  await page.getByLabel("Почта").fill(email);
  await page.getByRole("button", { name: "Получить ссылку для входа" }).click();
  await expect(
    page.getByText(`Письмо со ссылкой отправлено на ${email}`),
  ).toBeVisible();

  let text: string | null = null;
  await expect
    .poll(async () => (text = await newestLetterText(email, since)))
    .not.toBeNull();
  const link = text!.match(/https?:\/\/\S+\/api\/auth\/magic-link\/verify\S+/);
  expect(link).not.toBeNull();
  return link![0];
}

export async function logIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  const link = await requestLoginLink(page, email);
  await page.goto(link);
  await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
}
