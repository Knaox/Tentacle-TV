import { mkdtempSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, describe, expect, it } from "vitest";
import {
  discardSetupToken,
  formatSetupToken,
  generateSetupToken,
  normalizeSetupToken,
  readSetupToken,
  setupTokenBanner,
  setupTokensMatch,
  writeNewSetupToken,
} from "./setupToken";

const dir = mkdtempSync(join(tmpdir(), "wiz-token-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("code d'installation", () => {
  it("12 caractères de Crockford, affichés par blocs de quatre", () => {
    const token = generateSetupToken();
    expect(token).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
    expect(formatSetupToken("ABCDEFGHJKMN")).toBe("ABCD-EFGH-JKMN");
  });

  it("des codes tous différents", () => {
    expect(new Set(Array.from({ length: 200 }, () => generateSetupToken())).size).toBe(200);
  });

  it("la saisie tolère casse, tirets, espaces, et lit O pour 0, I et L pour 1", () => {
    expect(normalizeSetupToken(" abcd-efgh jkmn ")).toBe("ABCDEFGHJKMN");
    expect(normalizeSetupToken("OILO-0000-1111")).toBe("011000001111");
  });

  it("refuse ce qui ne peut pas être un code", () => {
    expect(normalizeSetupToken("ABCD-EFGH")).toBeNull();
    expect(normalizeSetupToken("ABCD-EFGH-JKMU")).toBeNull();
    expect(normalizeSetupToken(42)).toBeNull();
    expect(normalizeSetupToken(null)).toBeNull();
  });

  it("compare en temps constant, longueurs différentes comprises", () => {
    expect(setupTokensMatch("ABCDEFGHJKMN", "ABCDEFGHJKMN")).toBe(true);
    expect(setupTokensMatch("ABCDEFGHJKMN", "ABCDEFGHJKMP")).toBe(false);
    expect(setupTokensMatch("ABCDEFGHJKMN", "ABC")).toBe(false);
  });

  it("le fichier : écrit en 0600, relu, puis jeté une fois utilisé", () => {
    const file = join(dir, "setup-token.txt");
    const token = writeNewSetupToken(file);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(readSetupToken(file)).toBe(token);
    discardSetupToken(file);
    expect(readSetupToken(file)).toBeNull();
    expect(() => discardSetupToken(file)).not.toThrow();
  });

  it("le bandeau donne le code et le lien qui le pré-remplit par le fragment", () => {
    const lines = setupTokenBanner("ABCDEFGHJKMN", 3000).join("\n");
    expect(lines).toContain("ABCD-EFGH-JKMN");
    expect(lines).toContain(":3000/setup#code=ABCD-EFGH-JKMN");
  });
});
