import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E_DATABASE_URL } from "./database";
import { waitForLoginLink } from "./login";

// A brand-new account with an empty notebook (openspec/specs: contacts,
// groups, keep-in-touch, auth, privacy). Better Auth hands out five login
// links a minute, so the account signs in once and the scenarios run in
// order, each building on the one before.
test.describe.configure({ mode: "serial" });

const EMAIL = `zero-${Date.now()}@example.com`;
// Where the new account's session is kept for the scenarios after sign-in.
const ZERO_STATE = "e2e/.auth/zero.json";

function contactList(page: Page) {
  return page.getByRole("region", { name: "Список контактов" });
}

async function addContact(
  page: Page,
  fields: { name: string; group?: string; rhythm?: string },
) {
  await page.getByRole("link", { name: "Добавить контакт" }).click();
  await page.getByLabel("Имя").fill(fields.name);
  if (fields.group) {
    await page
      .getByRole("checkbox", { name: fields.group, exact: true })
      .check();
  }
  if (fields.rhythm) {
    await page
      .getByLabel("Как часто общаться")
      .selectOption({ label: fields.rhythm });
  }
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: fields.name, level: 2 }),
  ).toBeVisible();
}

test.describe("signing in", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("«Отправить ещё раз» sends a second letter, «Другая почта» brings the field back, the token is stored hashed", async ({
    page,
  }) => {
    await page.goto("/login");
    const since = new Date(Date.now() - 1000);
    await page.getByLabel("Почта").fill(EMAIL);
    await page
      .getByRole("button", { name: "Получить ссылку для входа" })
      .click();
    await expect(
      page.getByText(`Письмо со ссылкой отправлено на ${EMAIL}`),
    ).toBeVisible();
    const first = await waitForLoginLink(EMAIL, since);

    // The database keeps a hash of the token, never the token itself.
    const token = new URL(first).searchParams.get("token");
    expect(token).toBeTruthy();
    const db = new Client({ connectionString: E2E_DATABASE_URL });
    await db.connect();
    try {
      const { rows } = await db.query<{ identifier: string; value: string }>(
        "SELECT identifier, value FROM verifications ORDER BY id DESC LIMIT 1",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].identifier).not.toContain(token);
      expect(rows[0].value).not.toContain(token);
    } finally {
      await db.end();
    }

    await page.getByRole("button", { name: "Отправить ещё раз" }).click();
    let second = first;
    await expect
      .poll(async () => (second = await waitForLoginLink(EMAIL, since)))
      .not.toBe(first);

    await page.getByRole("button", { name: "Другая почта" }).click();
    await expect(page.getByLabel("Почта")).toBeFocused();
    await expect(page.getByLabel("Почта")).toHaveValue(EMAIL);

    await page.goto(second);
    await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
    await page.context().storageState({ path: ZERO_STATE });
  });
});

test.describe("an empty notebook", () => {
  test.use({ storageState: ZERO_STATE });

  test("the list says there are no contacts yet and offers the first", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(contactList(page).getByText("0 контактов")).toBeVisible();
    await expect(
      contactList(page).getByText("Контактов пока нет"),
    ).toBeVisible();

    await page.getByRole("link", { name: "Добавить первого" }).click();
    await expect(
      page.getByRole("heading", { name: "Новый контакт" }),
    ).toBeVisible();
  });

  test("without groups the row offers to create one, the panel says there are none, and «Без группы» knows when everyone is sorted", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Какую группу показать" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Создать группу" }).click();
    await expect(
      page.getByRole("heading", { name: "Группы", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByText("Групп пока нет. Например: «Работа», «Семья», «Соседи»."),
    ).toBeVisible();

    await page.getByLabel("Новая группа").fill("Семья");
    await page.getByLabel("Новая группа").press("Enter");
    await expect(
      page
        .getByRole("list", { name: "Все группы" })
        .getByText("Семья", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Готово" }).click();

    await addContact(page, { name: "Мама", group: "Семья" });
    await page
      .getByRole("navigation", { name: "Какую группу показать" })
      .getByRole("link", { name: "Без группы" })
      .click();
    await expect(
      contactList(page).getByText("Все контакты разложены по группам"),
    ).toBeVisible();
  });

  test("no one is due while every rhythm is fresh", async ({ page }) => {
    await page.goto("/");
    await addContact(page, { name: "Папа", rhythm: "Раз в год" });
    await page.getByRole("link", { name: /^Пора написать/ }).click();
    await expect(
      contactList(page).getByText("Сейчас никому не пора писать"),
    ).toBeVisible();
  });
});
