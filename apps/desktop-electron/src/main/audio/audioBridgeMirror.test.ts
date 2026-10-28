/**
 * Le contrat du pont audio est recopié OCTET POUR OCTET dans la page
 * (`packages/shared/src/octave/engine/audioBridgeContract.ts`) : la coquille est
 * compilée sans dépendre d'elle. Ce test refuse qu'ils divergent, et que la
 * liste fermée des canaux oublie une commande ou l'évènement du moteur.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMANDS, EVENTS } from "../channels";
import { AUDIO_BRIDGE_COMMANDS, AUDIO_BRIDGE_EVENT } from "./audioBridgeContract";

function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("racine du dépôt introuvable");
    folder = parent;
  }
  return folder;
}

describe("contrat du pont audio — la page et la coquille", () => {
  it("le miroir de la page est identique", () => {
    const root = repoRoot();
    const shell = readFileSync(join(root, "apps/desktop-electron/src/main/audio/audioBridgeContract.ts"), "utf8");
    const page = readFileSync(join(root, "packages/shared/src/octave/engine/audioBridgeContract.ts"), "utf8");
    expect(page).toBe(shell);
  });

  it("chaque commande et l'évènement sont dans la liste fermée des canaux", () => {
    const commands: readonly string[] = COMMANDS;
    const events: readonly string[] = EVENTS;
    for (const c of AUDIO_BRIDGE_COMMANDS) expect(commands).toContain(c);
    expect(events).toContain(AUDIO_BRIDGE_EVENT);
  });
});
