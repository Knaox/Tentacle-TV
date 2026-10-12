import { describe, expect, it } from "vitest";
import { approvedDisabled, parseRegValue, runCommand } from "./runKey";

describe("clé Run", () => {
  it("lit la donnée d'un nom contenant des espaces", () => {
    const output = [
      "",
      "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
      '    Tentacle Server    REG_SZ    "C:\\Program Files\\nodejs\\node.exe" "C:\\a b\\main.js" --app-root "C:\\a b"',
      "",
    ].join("\r\n");
    expect(parseRegValue(output, "Tentacle Server")).toBe('"C:\\Program Files\\nodejs\\node.exe" "C:\\a b\\main.js" --app-root "C:\\a b"');
    expect(parseRegValue(output, "Tentacle")).toBeNull();
    expect(parseRegValue("", "Tentacle Server")).toBeNull();
  });

  it("reconnaît une entrée désactivée par le Gestionnaire des tâches", () => {
    expect(approvedDisabled("030000004A1B2C3D4E5F6071")).toBe(true);
    expect(approvedDisabled("020000000000000000000000")).toBe(false);
    expect(approvedDisabled(null)).toBe(false);
  });

  it("met les chemins entre guillemets", () => {
    expect(runCommand("C:\\n\\node.exe", "C:\\h\\main.js", "C:\\r oot")).toBe('"C:\\n\\node.exe" "C:\\h\\main.js" --app-root "C:\\r oot" --autostart');
  });
});
