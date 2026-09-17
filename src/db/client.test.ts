import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "./client";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-client-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("openDatabase", () => {
  it("creates the folder and turns on WAL and foreign keys", () => {
    const filePath = path.join(dir, "nested", "crm.db");

    const db = openDatabase(filePath, { fileMustExist: false });

    expect(fs.existsSync(filePath)).toBe(true);
    expect(db.$client.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.$client.pragma("foreign_keys", { simple: true })).toBe(1);
    db.$client.close();
  });

  it("refuses to create a missing file when it must exist", () => {
    const filePath = path.join(dir, "missing.db");

    expect(() => openDatabase(filePath, { fileMustExist: true })).toThrow();
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
