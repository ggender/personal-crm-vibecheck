import { expect, test } from "@playwright/test";
import { DEMO_EMAIL, logIn, requestLoginLink } from "./login";

// Scenarios from specs/05-вход-и-пользователи.md. They start signed out.
test.use({ storageState: { cookies: [], origins: [] } });

function contactList(page: import("@playwright/test").Page) {
  return page.getByRole("region", { name: "Список контактов" });
}

test("a visitor signs in by the link from the letter, once, and signs out", async ({
  page,
}) => {
  // Signed out: any address leads to the login screen.
  await page.goto("/?contact=1");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Почта")).toBeFocused();

  const link = await requestLoginLink(page, DEMO_EMAIL);
  await page.goto(link);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(DEMO_EMAIL)).toBeVisible();
  await expect(contactList(page).getByText("999 контактов")).toBeVisible();

  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  // The same link does not work twice.
  await page.goto(link);
  await expect(
    page.getByText(
      "Ссылка для входа устарела или уже использована — получи новую.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Выйти" })).toHaveCount(0);
});

test("a new address gets an empty notebook and no one else's contacts", async ({
  page,
}) => {
  const email = `new-${Date.now()}@example.com`;

  await logIn(page, email);
  await expect(page.getByText(email)).toBeVisible();
  await expect(contactList(page).getByText("0 контактов")).toBeVisible();

  // Contact 1 belongs to the demo account.
  await page.goto("/?contact=1");
  await expect(
    page.getByRole("heading", { name: "Такого контакта больше нет" }),
  ).toBeVisible();
});

test("the login form asks for an address and keeps a mistyped one", async ({
  page,
}) => {
  await page.goto("/login");
  const send = page.getByRole("button", { name: "Получить ссылку для входа" });

  await send.click();
  await expect(page.getByText("Укажи почту")).toBeVisible();

  await page.getByLabel("Почта").fill("anna@example");
  await send.click();
  await expect(
    page.getByText("Проверь почту — похоже, в ней опечатка"),
  ).toBeVisible();
  await expect(page.getByLabel("Почта")).toHaveValue("anna@example");
});

// Better Auth answers the login form with an HTTP status; the form turns it
// into a sentence (openspec/specs/auth). No real letters are sent here.
const MAGIC_LINK_REQUEST = "**/api/auth/sign-in/magic-link";

async function askForLink(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Почта").fill("anna@example.com");
  await page.getByRole("button", { name: "Получить ссылку для входа" }).click();
}

test("too many login links say to wait a minute, without a retry", async ({
  page,
}) => {
  await page.route(MAGIC_LINK_REQUEST, (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ message: "Too many requests" }),
    }),
  );
  await askForLink(page);
  await expect(
    page.getByText("Слишком много попыток — подожди минуту"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Повторить" })).toHaveCount(0);
});

test("a letter that could not be sent can be requested again", async ({
  page,
}) => {
  await page.route(MAGIC_LINK_REQUEST, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "The login email could not be sent" }),
    }),
  );
  await askForLink(page);
  await expect(
    page.getByText("Не удалось отправить письмо", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();
});

test("a silent app keeps the address and offers to retry", async ({ page }) => {
  await page.route(MAGIC_LINK_REQUEST, (route) => route.abort());
  await askForLink(page);
  await expect(
    page.getByText("Не удалось отправить письмо: приложение не отвечает"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();
  await expect(page.getByLabel("Почта")).toHaveValue("anna@example.com");
});

test("an unknown link error asks for a new link", async ({ page }) => {
  await page.goto("/login?error=UNKNOWN");
  await expect(
    page.getByText("Не удалось войти по этой ссылке — получи новую."),
  ).toBeVisible();
});
