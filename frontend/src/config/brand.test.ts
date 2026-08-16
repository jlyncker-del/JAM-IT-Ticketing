import { describe, expect, it } from "vitest";
import { normalizeApiUrl } from "./brand";

describe("API-Konfiguration", () => {
  it("ergänzt den API-Pfad bei einer reinen Render-Backend-Adresse", () => {
    expect(normalizeApiUrl("https://jam-it-api.onrender.com/", true)).toBe("https://jam-it-api.onrender.com/api/v1");
  });

  it("entfernt einen abschließenden Slash vom vollständigen API-Pfad", () => {
    expect(normalizeApiUrl("https://jam-it-api.onrender.com/api/v1/", true)).toBe("https://jam-it-api.onrender.com/api/v1");
  });

  it("verhindert einen Produktionsstart mit der localhost-Standardkonfiguration", () => {
    expect(() => normalizeApiUrl(undefined, true)).toThrow(/VITE_API_URL/);
  });
});
