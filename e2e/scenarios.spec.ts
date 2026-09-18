import { expect, test, type Page, type Route } from "@playwright/test";

// Scenarios from specs/02-план-сборки.md, run in a real browser against the
// seeded database. Each test creates what it needs, so the order does not matter.

function contactList(page: Page) {
  return page.getByRole("region", { name: "Список контактов" });
}

function listRows(page: Page) {
  return contactList(page).getByRole("listitem");
}

function notes(page: Page) {
  return page.getByRole("region", { name: "Заметки" }).getByRole("listitem");
}

function noteField(page: Page) {
  return page.getByRole("textbox", { name: "Новая заметка" });
}

function searchField(page: Page) {
  return page.getByRole("searchbox", { name: "Поиск по имени" });
}

function cardHeading(page: Page, name: string) {
  return page.getByRole("heading", { name, level: 2 });
}

// "999 контактов" above the list when nothing is searched.
async function readTotal(page: Page): Promise<number> {
  const counter = contactList(page).getByText(/^\d+ контакт/);
  await expect(counter).toBeVisible();
  return Number.parseInt((await counter.textContent()) ?? "", 10);
}

async function addContact(
  page: Page,
  fields: { name: string; metContext?: string; firstNote?: string },
) {
  await page.getByRole("link", { name: "Добавить контакт" }).click();
  await page.getByLabel("Имя").fill(fields.name);
  await page.getByLabel("Откуда знакомы").fill(fields.metContext ?? "");
  await page.getByLabel("О чём договорились").fill(fields.firstNote ?? "");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(cardHeading(page, fields.name)).toBeVisible();
}

async function saveNote(page: Page, text: string) {
  await noteField(page).fill(text);
  await page.getByRole("button", { name: "Сохранить заметку" }).click();
}

test.describe("success criterion (plan, section 3)", () => {
  test("open, add, find by name, write a note, see it in another browser", async ({
    page,
    browser,
  }) => {
    const note = "Созвонились: пришлёт договор до пятницы";

    // Opened: the list of all contacts.
    await page.goto("/");
    const total = await readTotal(page);
    await expect(listRows(page)).toHaveCount(total);

    // Added a contact, found them by name, wrote a note.
    await addContact(page, { name: "Марк Орлов", metContext: "Приёмка V1" });
    await page.goto("/");
    await searchField(page).fill("орл");
    await expect(
      contactList(page).getByText(/^Найдено \d+ из \d+$/),
    ).toBeVisible();
    const found = contactList(page)
      .getByRole("link")
      .filter({ hasText: "Марк Орлов" })
      .filter({ hasText: "Приёмка V1" });
    await expect(found).toBeVisible();
    await found.click();
    await expect(cardHeading(page, "Марк Орлов")).toBeVisible();
    await saveNote(page, note);
    await expect(notes(page).first()).toContainText(note);
    await expect(notes(page).first()).toContainText("сегодня");
    await expect(noteField(page)).toHaveValue("");

    // The note stays in the card.
    await page.reload();
    await expect(notes(page).first()).toContainText(note);

    // The same address in another browser shows the same data.
    const otherBrowser = await browser.newContext();
    const otherPage = await otherBrowser.newPage();
    await otherPage.goto(page.url());
    await expect(cardHeading(otherPage, "Марк Орлов")).toBeVisible();
    await expect(notes(otherPage).first()).toContainText(note);
    await otherBrowser.close();
  });
});

test.describe("bad day (plan, section 5.2)", () => {
  test("a note that failed to save keeps its text and saves on retry", async ({
    page,
  }) => {
    const note = "Обещал перезвонить после отпуска";
    // Server Functions are POST requests marked with the Next-Action header.
    const dropServerFunctions = (route: Route) =>
      route.request().headers()["next-action"]
        ? route.abort()
        : route.continue();

    await page.goto("/");
    await listRows(page).first().getByRole("link").click();
    await page.route("**/*", dropServerFunctions);
    await saveNote(page, note);
    await expect(
      page.getByText(
        "Не удалось сохранить: приложение не отвечает. Текст на месте.",
      ),
    ).toBeVisible();
    await expect(noteField(page)).toHaveValue(note);

    await page.unroute("**/*", dropServerFunctions);
    await page.getByRole("button", { name: "Повторить" }).click();
    await expect(notes(page).first()).toContainText(note);
    await expect(noteField(page)).toHaveValue("");
    await expect(page.getByText("Не удалось сохранить")).toBeHidden();
  });

  test("a contact without a name asks for it and keeps the other fields", async ({
    page,
  }) => {
    const typed = {
      "Откуда знакомы": "Сосед по даче",
      Телефон: "+7 900 555-12-34",
      Почта: "sosed@example.com",
      "О чём договорились": "Обещал помочь с переездом",
    };

    await page.goto("/");
    await page.getByRole("link", { name: "Добавить контакт" }).click();
    for (const [label, value] of Object.entries(typed)) {
      await page.getByLabel(label).fill(value);
    }
    await page.getByRole("button", { name: "Добавить", exact: true }).click();

    await expect(page.getByText("Укажи имя")).toBeVisible();
    for (const [label, value] of Object.entries(typed)) {
      await expect(page.getByLabel(label)).toHaveValue(value);
    }
  });

  test("a link to a missing contact says so and the list keeps working", async ({
    page,
  }) => {
    const missing = page.getByRole("heading", {
      name: "Такого контакта больше нет",
    });

    await page.goto("/?contact=999999");
    await expect(missing).toBeVisible();
    await expect(page.getByRole("link", { name: "К списку" })).toBeVisible();

    await listRows(page).first().getByRole("link").click();
    await expect(missing).toBeHidden();
    await expect(noteField(page)).toBeVisible();
  });

  test("an empty search offers to add the typed name", async ({ page }) => {
    await page.goto("/");
    await searchField(page).fill("ыыы");
    await expect(
      contactList(page).getByText("Никого не нашлось"),
    ).toBeVisible();

    await page.getByRole("link", { name: "Добавить «ыыы»" }).click();
    await expect(
      page.getByRole("heading", { name: "Новый контакт" }),
    ).toBeVisible();
    await expect(page.getByLabel("Имя")).toHaveValue("ыыы");
  });
});

test.describe("odd cases (plan, section 5.3)", () => {
  test("deleting a contact names the note count, cancel keeps everything", async ({
    page,
  }) => {
    const name = "Эмилия Каскадова";
    const dialog = page.getByRole("alertdialog");
    const deleteButton = page.getByRole("button", { name: "Удалить контакт" });

    await page.goto("/");
    await addContact(page, { name, firstNote: "Позвать на новоселье" });
    await saveNote(page, "Вернула книгу");
    await expect(notes(page)).toHaveCount(2);
    const total = await readTotal(page);

    await deleteButton.click();
    await expect(dialog).toContainText(
      `Удалить контакт «${name}» и 2 заметки?`,
    );
    await dialog.getByRole("button", { name: "Отмена" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(cardHeading(page, name)).toBeVisible();
    await expect(notes(page)).toHaveCount(2);
    expect(await readTotal(page)).toBe(total);

    await deleteButton.click();
    await dialog.getByRole("button", { name: "Удалить", exact: true }).click();
    await expect.poll(() => readTotal(page)).toBe(total - 1);
    await expect(contactList(page).getByText(name)).toHaveCount(0);
  });
});
