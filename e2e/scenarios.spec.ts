import { expect, test, type Page, type Route } from "@playwright/test";
import { DEMO_STATE } from "./login";

// Scenarios from specs/02-план-сборки.md, run in a real browser against the
// seeded database, signed in as the demo account (auth.setup.ts). Each test
// creates what it needs, so the order does not matter.

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

// Server Functions are POST requests marked with the Next-Action header.
function dropServerFunctions(route: Route) {
  return route.request().headers()["next-action"]
    ? route.abort()
    : route.continue();
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

    // The same address in another browser, signed in to the same account,
    // shows the same data.
    const otherBrowser = await browser.newContext({ storageState: DEMO_STATE });
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

test.describe("keep in touch (specs/04-keep-in-touch.md)", () => {
  function dueLink(page: Page) {
    return page.getByRole("link", { name: /^Пора написать/ });
  }

  // "Пора написать 7" above the list.
  async function readDueCount(page: Page): Promise<number> {
    const text = (await dueLink(page).textContent()) ?? "";
    return Number.parseInt(text.replace(/\D/g, ""), 10);
  }

  function openContactId(page: Page): string | null {
    return new URL(page.url()).searchParams.get("contact");
  }

  // Opens the first row and waits until its card is in the address.
  async function openFirstRow(page: Page): Promise<string> {
    const row = listRows(page).first().getByRole("link");
    const id = (await row.getAttribute("data-contact-id")) ?? "";
    await row.click();
    await expect.poll(() => openContactId(page)).toBe(id);
    return id;
  }

  // Uses the seed: a few of the 999 contacts keep in touch and are overdue.
  test("«Пообщались» and a new note both take a contact off the list", async ({
    page,
  }) => {
    await page.goto("/");
    const before = await readDueCount(page);
    expect(before).toBeGreaterThanOrEqual(2);

    await dueLink(page).click();
    await expect(dueLink(page)).toHaveAttribute("aria-current", "page");
    await expect(listRows(page)).toHaveCount(before);
    await expect(listRows(page).first()).toContainText(/\d+ д(ень|ня|ней)/);

    // Talked without a note.
    const talkedId = await openFirstRow(page);
    await expect(page.getByText(/пора написать: \d+ д/)).toBeVisible();
    await page.getByRole("button", { name: "Пообщались" }).click();
    await expect(page.getByText(/следующий раз через \d+ д/)).toBeVisible();
    await expect.poll(() => readDueCount(page)).toBe(before - 1);
    await expect(
      contactList(page).locator(`[data-contact-id="${talkedId}"]`),
    ).toHaveCount(0);
    // The list stays «Пора написать» and the card stays open.
    expect(new URL(page.url()).searchParams.get("due")).toBe("1");
    expect(openContactId(page)).toBe(talkedId);

    // Wrote a note instead.
    const notedId = await openFirstRow(page);
    expect(notedId).not.toBe(talkedId);
    await expect(page.getByText(/пора написать: \d+ д/)).toBeVisible();
    await saveNote(page, "Написал, договорились созвониться в субботу");
    await expect.poll(() => readDueCount(page)).toBe(before - 2);
    await expect(
      contactList(page).locator(`[data-contact-id="${notedId}"]`),
    ).toHaveCount(0);
  });

  test("a «Пообщались» that failed to save says so and works on retry", async ({
    page,
  }) => {
    await page.goto("/?due=1");
    await openFirstRow(page);
    await page.route("**/*", dropServerFunctions);
    await page.getByRole("button", { name: "Пообщались" }).click();
    await expect(
      page.getByText("Не удалось отметить: приложение не отвечает"),
    ).toBeVisible();
    await expect(page.getByText(/пора написать: \d+ д/)).toBeVisible();

    await page.unroute("**/*", dropServerFunctions);
    await page.getByRole("button", { name: "Повторить" }).click();
    await expect(page.getByText(/следующий раз через \d+ д/)).toBeVisible();
    await expect(page.getByText("Не удалось отметить")).toBeHidden();
  });

  test("a rhythm is chosen in the contact form and can be removed", async ({
    page,
  }) => {
    const name = "Лев Ритмов";
    const rhythm = page.getByLabel("Как часто общаться");

    await page.goto("/");
    await page.getByRole("link", { name: "Добавить контакт" }).click();
    await page.getByLabel("Имя").fill(name);
    await rhythm.selectOption({ label: "Раз в 2 недели" });
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    await expect(cardHeading(page, name)).toBeVisible();
    await expect(
      page.getByText("Раз в 2 недели · следующий раз через 14 дней"),
    ).toBeVisible();

    await page.getByRole("link", { name: "Изменить" }).click();
    await expect(rhythm).toHaveValue("14");
    await rhythm.selectOption({ label: "Не следить" });
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(cardHeading(page, name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Пообщались" })).toHaveCount(
      0,
    );
  });

  test("the search works inside the list and can widen to everyone", async ({
    page,
  }) => {
    await page.goto("/?due=1");
    await searchField(page).fill("ыыы");
    await expect(
      contactList(page).getByText(
        "Среди тех, кому пора написать, никого не нашлось",
      ),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("due")).toBe("1");

    await page.getByRole("link", { name: "Искать среди всех" }).click();
    await expect(
      contactList(page).getByText("Никого не нашлось", { exact: true }),
    ).toBeVisible();
    await expect(dueLink(page)).not.toHaveAttribute("aria-current", "page");
  });
});
