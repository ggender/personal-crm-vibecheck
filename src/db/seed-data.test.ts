import { describe, expect, it } from "vitest";
import { femaleSurname, transliterate } from "./seed-data";

describe("femaleSurname", () => {
  it("builds female forms of Russian surnames", () => {
    expect(femaleSurname("Иванов")).toBe("Иванова");
    expect(femaleSurname("Королёв")).toBe("Королёва");
    expect(femaleSurname("Аннин")).toBe("Аннина");
    expect(femaleSurname("Достоевский")).toBe("Достоевская");
    expect(femaleSurname("Толстой")).toBe("Толстая");
  });

  it("keeps surnames that do not change", () => {
    for (const surname of ["Цой", "Ким", "Шевченко", "Черных"]) {
      expect(femaleSurname(surname)).toBe(surname);
    }
  });
});

describe("transliterate", () => {
  it("makes an email-safe Latin form", () => {
    expect(transliterate("Щёкина-Юрьева")).toBe("shchekina-yureva");
  });
});
