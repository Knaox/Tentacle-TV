import { describe, expect, it } from "vitest";
import { HTTP_URL, isHttpUrl } from "./httpUrl";

describe("isHttpUrl", () => {
  it("accepte un serveur en HTTP ou HTTPS, adresse privée comprise", () => {
    expect(isHttpUrl("http://192.168.1.20:8096")).toBe(true);
    expect(isHttpUrl("https://tentacle.example.org/api/jellyfin")).toBe(true);
    expect(isHttpUrl("http://localhost:3001")).toBe(true);
  });

  it("refuse tout autre schéma, les identifiants et ce qui n'est pas une URL", () => {
    for (const raw of ["file:///etc/passwd", "data:text/plain,x", "tentacle://app/", "ftp://h/", "javascript:alert(1)", "http://u:p@h/", "", "/api"]) {
      expect(isHttpUrl(raw)).toBe(false);
    }
  });

  it("se branche dans un schéma zod", () => {
    expect(HTTP_URL.safeParse("https://h").success).toBe(true);
    expect(HTTP_URL.safeParse("file:///x").success).toBe(false);
  });
});
