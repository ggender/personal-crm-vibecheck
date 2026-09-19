import { expect, test, type Page, type Route } from "@playwright/test";
import { Client } from "pg";
import { E2E_DATABASE_URL } from "./database";
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

function outdatedHeading(page: Page) {
  return page.getByRole("heading", { name: "База устарела" });
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

// An id twice on the page means a stale copy of a control was left behind.
function duplicateIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
    return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  });
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

  test("a database behind the code asks for npm run db:migrate", async ({
    page,
    browser,
  }) => {
    const signedOut = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const loginPage = await signedOut.newPage();
    const db = new Client({ connectionString: E2E_DATABASE_URL });
    await db.connect();
    // As if the newest migration had not been applied yet.
    const {
      rows: [removed],
    } = await db.query<{ hash: string; created_at: string }>(
      `DELETE FROM drizzle.__drizzle_migrations
       WHERE created_at = (SELECT max(created_at) FROM drizzle.__drizzle_migrations)
       RETURNING hash, created_at`,
    );
    try {
      const response = await page.goto("/");
      await expect(outdatedHeading(page)).toBeVisible();
      await expect(page.getByText("npm run db:migrate")).toBeVisible();
      // The app itself did not run: its queries would hit missing tables.
      expect(await response?.text()).not.toContain("Список контактов");

      // The login page asks too, before it looks for a session.
      await loginPage.goto("/login");
      await expect(outdatedHeading(loginPage)).toBeVisible();
    } finally {
      await signedOut.close();
      await db.query(
        "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
        [removed.hash, removed.created_at],
      );
      await db.end();
    }

    await page.getByRole("button", { name: "Проверить снова" }).click();
    await expect(contactList(page)).toBeVisible();
    await expect(outdatedHeading(page)).toHaveCount(0);
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
    await page.getByRole("button", { name: "Пообщались", exact: true }).click();
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
    await page.getByRole("button", { name: "Пообщались", exact: true }).click();
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
    // The card shows the rhythm in its own select.
    await expect(rhythm).toHaveValue("14");
    await expect(page.getByText("следующий раз через 14 дней")).toBeVisible();

    await page.getByRole("link", { name: "Изменить" }).click();
    await expect(rhythm).toHaveValue("14");
    await rhythm.selectOption({ label: "Не следить" });
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(cardHeading(page, name)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Пообщались", exact: true }),
    ).toHaveCount(0);
  });

  function rowTalkedButton(page: Page) {
    return page.getByRole("button", { name: /^Пообщались: / });
  }

  test("«Пообщались» in a row takes the contact off the list without opening it", async ({
    page,
  }) => {
    await page.goto("/?due=1");
    const before = await readDueCount(page);
    expect(before).toBeGreaterThanOrEqual(2);
    const rows = listRows(page);
    const firstId = await rows
      .first()
      .getByRole("link")
      .getAttribute("data-contact-id");
    const secondId = await rows
      .nth(1)
      .getByRole("link")
      .getAttribute("data-contact-id");

    // From the keyboard: the focus moves on to the next row's button.
    await rowTalkedButton(page).first().focus();
    await page.keyboard.press("Enter");
    await expect(
      contactList(page).locator(`[data-contact-id="${firstId}"]`),
    ).toHaveCount(0);
    await expect.poll(() => readDueCount(page)).toBe(before - 1);
    await expect(rows.first().getByRole("link")).toHaveAttribute(
      "data-contact-id",
      secondId ?? "",
    );
    await expect(rows.first().getByRole("button")).toBeFocused();
    // No card was opened on the way.
    expect(openContactId(page)).toBeNull();
    expect(new URL(page.url()).searchParams.get("due")).toBe("1");
  });

  test("a «Пообщались» in a row that failed to save says so and works on retry", async ({
    page,
  }) => {
    await page.goto("/?due=1");
    const row = listRows(page).first();
    const id = await row.getByRole("link").getAttribute("data-contact-id");
    await page.route("**/*", dropServerFunctions);
    await row.getByRole("button").click();
    await expect(
      row.getByText("Не удалось отметить: приложение не отвечает"),
    ).toBeVisible();
    await expect(row.getByRole("link")).toHaveAttribute(
      "data-contact-id",
      id ?? "",
    );

    await page.unroute("**/*", dropServerFunctions);
    await row.getByRole("button", { name: "Повторить" }).click();
    await expect(
      contactList(page).locator(`[data-contact-id="${id}"]`),
    ).toHaveCount(0);
  });

  test("the rhythm is changed right in the card, without «Изменить»", async ({
    page,
  }) => {
    const rhythm = page.getByLabel("Как часто общаться");
    const talked = page.getByRole("button", {
      name: "Пообщались",
      exact: true,
    });

    await page.goto("/");
    await addContact(page, { name: "Нина Ритмова" });
    await expect(rhythm).toHaveValue("");
    await expect(talked).toHaveCount(0);

    await rhythm.selectOption({ label: "Раз в месяц" });
    await expect(page.getByText("следующий раз через 30 дней")).toBeVisible();
    await expect(talked).toBeVisible();
    // Saved, not just shown.
    await page.reload();
    await expect(rhythm).toHaveValue("30");

    await rhythm.selectOption({ label: "Не следить" });
    await expect(talked).toHaveCount(0);
    await expect(page.getByText(/следующий раз через/)).toHaveCount(0);
    await page.reload();
    await expect(rhythm).toHaveValue("");
  });

  test("a rhythm that failed to save in the card says so and saves on retry", async ({
    page,
  }) => {
    const rhythm = page.getByLabel("Как часто общаться");

    await page.goto("/");
    await addContact(page, { name: "Глеб Ритмов" });
    await page.route("**/*", dropServerFunctions);
    await rhythm.selectOption({ label: "Раз в год" });
    await expect(
      page.getByText(
        "Не удалось сохранить, как часто общаться: приложение не отвечает",
      ),
    ).toBeVisible();
    // The select shows what is really saved.
    await expect(rhythm).toHaveValue("");

    await page.unroute("**/*", dropServerFunctions);
    await page.getByRole("button", { name: "Повторить" }).click();
    await expect(page.getByText("следующий раз через 365 дней")).toBeVisible();
    await expect(rhythm).toHaveValue("365");
    await expect(page.getByText("Не удалось сохранить")).toBeHidden();
  });

  test("switching between contacts leaves one rhythm select in the card", async ({
    page,
  }) => {
    await page.goto("/?due=1");
    const rows = listRows(page);
    // Both a rhythm and «Пообщались» in the line; clicked, not reloaded.
    for (const index of [0, 1, 2, 0]) {
      const link = rows.nth(index).getByRole("link");
      const id = await link.getAttribute("data-contact-id");
      await link.click();
      await expect.poll(() => openContactId(page)).toBe(id);
      await expect(
        page.getByRole("button", { name: "Пообщались", exact: true }),
      ).toHaveCount(1);
      expect(await duplicateIds(page)).toEqual([]);
    }
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

test.describe("groups (specs/06-группы.md)", () => {
  function groupNav(page: Page) {
    return page.getByRole("navigation", { name: "Какую группу показать" });
  }

  // A group above the list: its name, then how many contacts it has.
  function groupChip(page: Page, name: string) {
    return groupNav(page).getByRole("link", {
      name: new RegExp(`^${name}\\s*\\d+$`),
    });
  }

  function groupsPanelList(page: Page) {
    return page.getByRole("list", { name: "Все группы" });
  }

  function newGroupField(page: Page) {
    return page.getByLabel("Новая группа");
  }

  // The × on a group of the open card.
  function removeFromGroup(page: Page, name: string) {
    return page.getByRole("button", { name: `Убрать из группы «${name}»` });
  }

  function addToGroup(page: Page) {
    return page.getByLabel("Добавить в группу");
  }

  test("a group is created, renamed and deleted in the groups panel", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Настроить группы" }).click();
    await expect(
      page.getByRole("heading", { name: "Группы", level: 2 }),
    ).toBeVisible();
    await expect(newGroupField(page)).toBeFocused();

    await newGroupField(page).fill("Хор");
    await newGroupField(page).press("Enter");
    await expect(
      groupsPanelList(page).getByText("Хор", { exact: true }),
    ).toBeVisible();
    await expect(newGroupField(page)).toHaveValue("");
    await expect(groupChip(page, "Хор")).toBeVisible();

    // The same name in other letters is the same group.
    await newGroupField(page).fill("ХОР");
    await page.getByRole("button", { name: "Создать группу" }).click();
    await expect(page.getByText("Группа «ХОР» уже есть")).toBeVisible();
    await expect(newGroupField(page)).toHaveValue("ХОР");

    await page
      .getByRole("button", { name: "Переименовать группу «Хор»" })
      .click();
    const renameField = page.getByLabel("Новое название группы «Хор»");
    await expect(renameField).toBeFocused();
    await renameField.fill("Хор при ДК");
    await renameField.press("Enter");
    await expect(
      groupsPanelList(page).getByText("Хор при ДК", { exact: true }),
    ).toBeVisible();
    await expect(groupChip(page, "Хор при ДК")).toBeVisible();

    await page
      .getByRole("button", { name: "Удалить группу «Хор при ДК»" })
      .click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Удалить группу «Хор при ДК»?");
    await expect(dialog).toContainText("Контакты останутся");
    await dialog.getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(groupsPanelList(page).getByText("Хор при ДК")).toHaveCount(0);
    await expect(groupChip(page, "Хор при ДК")).toHaveCount(0);
  });

  test("a contact joins groups in its form and the list narrows to a group", async ({
    page,
  }) => {
    const name = "Зинаида Хоровая";
    const group = "Хор по четвергам";

    await page.goto("/");
    await page.getByRole("link", { name: "Добавить контакт" }).click();
    await page.getByLabel("Имя").fill(name);
    // Enter in «Новая группа» makes the group and does not save the contact.
    await newGroupField(page).fill(group);
    await newGroupField(page).press("Enter");
    await expect(
      page.getByRole("checkbox", { name: group, exact: true }),
    ).toBeChecked();
    await expect(page.getByLabel("Имя")).toHaveValue(name);
    await expect(newGroupField(page)).toHaveValue("");
    await page.getByRole("checkbox", { name: "Друзья", exact: true }).check();
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    await expect(cardHeading(page, name)).toBeVisible();
    await expect(removeFromGroup(page, "Друзья")).toBeVisible();
    await expect(removeFromGroup(page, group)).toBeVisible();
    const cardUrl = page.url();

    // One group: only its people, and the open card stays.
    await groupChip(page, group).click();
    await expect(groupChip(page, group)).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(listRows(page)).toHaveCount(1);
    expect(await readTotal(page)).toBe(1);
    await expect(cardHeading(page, name)).toBeVisible();

    // Not among those without a group.
    await groupNav(page).getByRole("link", { name: "Без группы" }).click();
    await searchField(page).fill("хоровая");
    await expect(
      contactList(page).getByText(
        "Среди контактов без группы никого не нашлось",
      ),
    ).toBeVisible();

    // Taken out of the group in the form, the group is empty.
    await page.goto(cardUrl);
    await page.getByRole("link", { name: "Изменить" }).click();
    await page.getByRole("checkbox", { name: group, exact: true }).uncheck();
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(cardHeading(page, name)).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Карточка контакта" })
        .getByText("Друзья", { exact: true }),
    ).toBeVisible();
    await groupChip(page, group).click();
    await expect(
      contactList(page).getByText(`В группе «${group}» пока никого`),
    ).toBeVisible();
  });

  test("a contact joins and leaves groups right in the card", async ({
    page,
  }) => {
    const name = "Олег Карточкин";

    await page.goto("/");
    await addContact(page, { name });
    const card = page.getByRole("region", { name: "Карточка контакта" });
    await expect(card.getByText("без группы")).toBeVisible();

    await addToGroup(page).selectOption({ label: "Друзья" });
    await expect(removeFromGroup(page, "Друзья")).toBeVisible();
    await expect(addToGroup(page)).toHaveValue("");
    await addToGroup(page).selectOption({ label: "Спорт" });
    await expect(removeFromGroup(page, "Спорт")).toBeVisible();
    await expect(card.getByText("без группы")).toHaveCount(0);

    // Saved: still there after a reload, and the group finds him.
    await page.reload();
    await expect(removeFromGroup(page, "Друзья")).toBeVisible();
    await groupChip(page, "Спорт").click();
    await searchField(page).fill("карточкин");
    await expect(listRows(page)).toHaveCount(1);

    // Out of one group, the other stays; the card stays open.
    await removeFromGroup(page, "Спорт").click();
    await expect(removeFromGroup(page, "Спорт")).toHaveCount(0);
    await expect(addToGroup(page)).toBeFocused();
    await expect(
      contactList(page).getByText("В группе «Спорт» никого не нашлось"),
    ).toBeVisible();
    await expect(removeFromGroup(page, "Друзья")).toBeVisible();
    await expect(cardHeading(page, name)).toBeVisible();
  });

  test("a group that failed to be added in the card says so and is added on retry", async ({
    page,
  }) => {
    await page.goto("/");
    await addContact(page, { name: "Ян Групповой" });
    await page.route("**/*", dropServerFunctions);
    await addToGroup(page).selectOption({ label: "Друзья" });
    await expect(
      page.getByText("Не удалось добавить в группу: приложение не отвечает"),
    ).toBeVisible();
    await expect(removeFromGroup(page, "Друзья")).toHaveCount(0);

    await page.unroute("**/*", dropServerFunctions);
    await page.getByRole("button", { name: "Повторить" }).click();
    await expect(removeFromGroup(page, "Друзья")).toBeVisible();
    await expect(page.getByText("Не удалось добавить в группу")).toBeHidden();
  });

  test("«+» inside a group starts the new contact in that group", async ({
    page,
  }) => {
    const name = "Тимур Соседский";

    await page.goto("/");
    await groupChip(page, "Соседи").click();
    await expect(groupChip(page, "Соседи")).toHaveAttribute(
      "aria-current",
      "page",
    );
    const before = await readTotal(page);
    await page.getByRole("link", { name: "Добавить контакт" }).click();
    await expect(
      page.getByRole("checkbox", { name: "Соседи", exact: true }),
    ).toBeChecked();
    await page.getByLabel("Имя").fill(name);
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    await expect(cardHeading(page, name)).toBeVisible();

    // Still in the group, now one more.
    expect(new URL(page.url()).searchParams.get("group")).not.toBeNull();
    await expect.poll(() => readTotal(page)).toBe(before + 1);
    await expect(contactList(page).getByText(name)).toBeVisible();
  });

  test("a group works together with the search and «Пора написать»", async ({
    page,
  }) => {
    const dueLink = page.getByRole("link", { name: /^Пора написать/ });

    await page.goto("/");
    await groupChip(page, "Работа").click();
    await dueLink.click();
    await expect(dueLink).toHaveAttribute("aria-current", "page");
    await expect(groupChip(page, "Работа")).toHaveAttribute(
      "aria-current",
      "page",
    );
    const params = new URL(page.url()).searchParams;
    expect(params.get("due")).toBe("1");
    expect(params.get("group")).not.toBeNull();

    // Two namesakes: the one from ProductCamp is at work, the other a neighbour.
    await page.getByRole("link", { name: "Все", exact: true }).click();
    await searchField(page).fill("анна пет");
    await expect(listRows(page)).toHaveCount(1);
    await expect(listRows(page)).toContainText("Конференция ProductCamp");
    await expect(groupChip(page, "Работа")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("a group that failed to create keeps its name and is made on retry", async ({
    page,
  }) => {
    await page.goto("/?groups=1");
    await page.route("**/*", dropServerFunctions);
    await newGroupField(page).fill("Бадминтон");
    await page.getByRole("button", { name: "Создать группу" }).click();
    await expect(
      page.getByText(
        "Не удалось создать группу: приложение не отвечает. Название на месте.",
      ),
    ).toBeVisible();
    await expect(newGroupField(page)).toHaveValue("Бадминтон");

    await page.unroute("**/*", dropServerFunctions);
    await page.getByRole("button", { name: "Повторить" }).click();
    await expect(
      groupsPanelList(page).getByText("Бадминтон", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Не удалось создать группу")).toBeHidden();
  });
});

// Scenarios of openspec/specs that had no test in the baseline: contacts,
// search, notes, groups, auth, ownership, privacy, database-status.
test.describe("baseline scenarios", () => {
  function card(page: Page) {
    return page.getByRole("region", { name: "Карточка контакта" });
  }

  test("the form starts in the name field; Enter saves from a field and breaks a line in the note", async ({
    page,
  }) => {
    const firstNote = page.getByLabel("О чём договорились");

    await page.goto("/");
    await page.getByRole("link", { name: "Добавить контакт" }).click();
    await expect(page.getByLabel("Имя")).toBeFocused();

    await firstNote.fill("первая строка");
    await firstNote.press("Enter");
    await firstNote.pressSequentially("вторая");
    await expect(firstNote).toHaveValue("первая строка\nвторая");
    await expect(
      page.getByRole("heading", { name: "Новый контакт" }),
    ).toBeVisible();

    await page.getByLabel("Имя").fill("Энтер Клавишин");
    await page.getByLabel("Имя").press("Enter");
    await expect(cardHeading(page, "Энтер Клавишин")).toBeVisible();
    await expect(notes(page).first()).toContainText("вторая");
  });

  test("«Отмена» in the edit form leaves the contact as it was", async ({
    page,
  }) => {
    await page.goto("/");
    await addContact(page, { name: "Ольга Прежняя" });
    await page.getByRole("link", { name: "Изменить" }).click();
    await page.getByLabel("Имя").fill("Ольга Новая");
    await page.getByRole("link", { name: "Отмена" }).click();
    await expect(cardHeading(page, "Ольга Прежняя")).toBeVisible();
    await page.reload();
    await expect(cardHeading(page, "Ольга Прежняя")).toBeVisible();
  });

  test("a contact form that failed to save keeps every field and saves on retry", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Добавить контакт" }).click();
    await page.getByLabel("Имя").fill("Сеть Пропалова");
    await page.getByLabel("Откуда знакомы").fill("Дача");
    await page.route("**/*", dropServerFunctions);
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    await expect(
      page.getByText(
        "Не удалось сохранить: приложение не отвечает. Введённое на месте.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Имя")).toHaveValue("Сеть Пропалова");
    await expect(page.getByLabel("Откуда знакомы")).toHaveValue("Дача");

    await page.unroute("**/*", dropServerFunctions);
    await page.getByRole("button", { name: "Повторить" }).click();
    await expect(cardHeading(page, "Сеть Пропалова")).toBeVisible();
  });

  test("the card shows «не указано» for empty fields and links for phone and email", async ({
    page,
  }) => {
    await page.goto("/");
    await addContact(page, { name: "Пустой Полев" });
    await expect(card(page).getByText("не указано")).toHaveCount(3);

    await page.getByRole("link", { name: "Добавить контакт" }).click();
    await page.getByLabel("Имя").fill("Связной Полев");
    await page.getByLabel("Телефон").fill("+7 (900) 555-12-34");
    await page.getByLabel("Почта").fill("svyaznoy@example.com");
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    await expect(cardHeading(page, "Связной Полев")).toBeVisible();
    await expect(
      card(page).getByRole("link", { name: "+7 (900) 555-12-34" }),
    ).toHaveAttribute("href", "tel:+79005551234");
    await expect(
      card(page).getByRole("link", { name: "svyaznoy@example.com" }),
    ).toHaveAttribute("href", "mailto:svyaznoy@example.com");
  });

  test("the open contact is marked in the list and scrolled into view", async ({
    page,
  }) => {
    await page.goto("/");
    const first = listRows(page).first().getByRole("link");
    await first.click();
    await expect(first).toHaveAttribute("aria-current", "page");

    const lastId = await listRows(page)
      .last()
      .getByRole("link")
      .getAttribute("data-contact-id");
    await page.goto(`/?contact=${lastId}`);
    const row = contactList(page).locator(`[data-contact-id="${lastId}"]`);
    await expect(row).toHaveAttribute("aria-current", "page");
    await expect(row).toBeInViewport();
  });

  test("a skip link leads from the search straight to the card panel", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(searchField(page)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("link", { name: "Перейти к карточке" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(card(page)).toBeFocused();
  });

  test("the start screen asks who you just talked to and puts the cursor in the search", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "С кем ты только что говорил?" }),
    ).toBeVisible();
    await expect(searchField(page)).toBeFocused();
  });

  test("the search waits 250 ms after the last letter and sends Enter at once", async ({
    page,
  }) => {
    // Navigation requests of the app router, without link prefetches.
    const sent: string[] = [];
    page.on("request", (request) => {
      const headers = request.headers();
      const url = new URL(request.url());
      if (headers["rsc"] && !headers["next-router-prefetch"]) {
        const q = url.searchParams.get("q");
        if (q !== null) {
          sent.push(q);
        }
      }
    });

    await page.goto("/");
    await expect(searchField(page)).toBeFocused();
    await page.clock.install();

    await searchField(page).pressSequentially("ор");
    await page.clock.runFor(200);
    await searchField(page).pressSequentially("л");
    await page.clock.runFor(200);
    expect(sent).toEqual([]);
    await page.clock.runFor(100);
    await expect.poll(() => sent).toEqual(["орл"]);
    await expect(contactList(page).getByText(/^Найдено/)).toBeVisible();

    await searchField(page).pressSequentially("о");
    await searchField(page).press("Enter");
    await expect.poll(() => sent).toEqual(["орл", "орло"]);
  });

  test("the note counter appears near the limit and marks an overflow", async ({
    page,
  }) => {
    await page.goto("/");
    await listRows(page).first().getByRole("link").click();
    await noteField(page).fill("а".repeat(4500));
    await expect(page.getByText("4500 из 5000 знаков")).toBeVisible();
    await expect(noteField(page)).toHaveAttribute("aria-invalid", "false");

    await noteField(page).fill("а".repeat(5001));
    await expect(page.getByText("5001 из 5000 знаков")).toBeVisible();
    await expect(noteField(page)).toHaveAttribute("aria-invalid", "true");

    await noteField(page).fill("а".repeat(4499));
    await expect(page.getByText(/из 5000 знаков/)).toHaveCount(0);
  });

  test("a contact without notes says the feed is empty", async ({ page }) => {
    await page.goto("/");
    await addContact(page, { name: "Тихий Безнотов" });
    await expect(
      page.getByText("Заметок пока нет. Запиши, о чём договорились."),
    ).toBeVisible();
  });

  test("deleting a note asks in a dialog and returns the focus to the note field", async ({
    page,
  }) => {
    const dialog = page.getByRole("alertdialog");

    await page.goto("/");
    await addContact(page, { name: "Нота Удалова", firstNote: "Черновик" });
    await page.getByRole("button", { name: "Удалить заметку" }).click();
    await expect(dialog).toContainText("Удалить сегодняшнюю заметку?");
    await expect(dialog).toContainText("Вернуть удалённую заметку нельзя.");
    await expect(dialog.getByRole("button", { name: "Отмена" })).toBeFocused();

    await dialog.getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(notes(page)).toHaveCount(0);
    await expect(noteField(page)).toBeFocused();
  });

  test("Escape leaves the group name as it was and returns to «Переименовать»", async ({
    page,
  }) => {
    const rename = page.getByRole("button", {
      name: "Переименовать группу «Друзья»",
    });
    const field = page.getByLabel("Новое название группы «Друзья»");

    await page.goto("/?groups=1");
    await rename.click();
    await field.fill("Приятели");
    await field.press("Escape");
    await expect(field).toHaveCount(0);
    await expect(
      page
        .getByRole("list", { name: "Все группы" })
        .getByText("Друзья", { exact: true }),
    ).toBeVisible();
    await expect(rename).toBeFocused();
  });

  test("a signed-in visitor of /login lands on the list", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
    await expect(contactList(page)).toBeVisible();
  });

  test("an expired session refuses to save and keeps the note text", async ({
    page,
    context,
  }) => {
    const note = "Договорились встретиться в четверг";

    await page.goto("/");
    await listRows(page).first().getByRole("link").click();
    await noteField(page).fill(note);
    // The session ended elsewhere: the page is still open.
    await context.clearCookies();
    await page.getByRole("button", { name: "Сохранить заметку" }).click();
    await expect(page.getByText("Вход истёк — войди снова")).toBeVisible();
    await expect(page.getByRole("button", { name: "Повторить" })).toHaveCount(
      0,
    );
    await expect(noteField(page)).toHaveValue(note);
  });

  test("a database that cannot be read shows «Что-то сломалось» without the search text", async ({
    page,
  }) => {
    const db = new Client({ connectionString: E2E_DATABASE_URL });
    await db.connect();
    // As if the database could not be read: the migrations and the session
    // are fine, the contacts are not.
    await db.query("ALTER TABLE contacts RENAME TO contacts_unavailable");
    try {
      await page.goto("/?q=секретноеслово");
      await expect(
        page.getByRole("heading", { name: "Что-то сломалось" }),
      ).toBeVisible();
      await expect(page.getByText("Код ошибки:")).toBeVisible();
      await expect(page.getByText("секретноеслово")).toHaveCount(0);
    } finally {
      await db.query("ALTER TABLE contacts_unavailable RENAME TO contacts");
      await db.end();
    }

    await page.getByRole("button", { name: "Попробовать снова" }).click();
    await expect(contactList(page)).toBeVisible();
  });
});
