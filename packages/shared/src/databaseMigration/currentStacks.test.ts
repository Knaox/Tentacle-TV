import { existsSync } from "fs";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";
import { CURRENT_STACKS, isCurrentStack, stackDownloadCommand } from "./currentStacks";

function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("racine du dépôt introuvable");
    folder = parent;
  }
  return folder;
}

describe("les piles d'aujourd'hui, pour passer à la nouvelle", () => {
  it("chacune existe dans le dépôt, à l'adresse que la commande télécharge", () => {
    for (const stack of CURRENT_STACKS) {
      expect(existsSync(join(repoRoot(), "stacks", stack, "compose.yaml")), stack).toBe(true);
      expect(stackDownloadCommand(stack)).toBe(`curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/${stack}/compose.yaml`);
    }
  });

  it("une valeur du serveur inconnue n'en est pas une", () => {
    expect(isCurrentStack("tentacle-full")).toBe(true);
    expect(isCurrentStack("tentacle-db")).toBe(false);
    expect(isCurrentStack(null)).toBe(false);
  });
});
