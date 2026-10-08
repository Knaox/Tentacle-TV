/**
 * L'espace `adminDatabaseMigration` : les deux langues ont les mêmes clés, et
 * la marche à suivre pour retirer MariaDB d'une pile officielle dit, ligne par
 * ligne, tout ce qu'il faut toucher (relevé sur les piles livrées en 1.24 :
 * services `db` et `init`, `depends_on`, `DB_HOST`, `DB_PASSWORD_FILE`, volumes
 * `tentacle-db` et `tentacle-secrets`) — et l'erreur EXACTE de Compose quand un
 * `depends_on` est oublié (mesurée avec docker-compose 5.6).
 */

import { describe, expect, it } from "vitest";
import en from "./locales/en/adminDatabaseMigration";
import fr from "./locales/fr/adminDatabaseMigration";

describe("vocabulaire de la migration MariaDB → SQLite (administration)", () => {
  it("le français et l'anglais ont les mêmes clés, aucune vide, et le même nombre d'étapes", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    expect([...Object.values(fr), ...Object.values(en)].filter((value) => value.trim() === "")).toEqual([]);
    for (const key of Object.keys(fr) as Array<keyof typeof fr>) {
      expect(en[key].split("\n").length, key).toBe(fr[key].split("\n").length);
    }
  });

  for (const [lang, copy] of [["fr", fr], ["en", en]] as const) {
    it(`${lang} : pile officielle — chaque ligne à retirer, puis l'application, une étape par ligne`, () => {
      const steps = copy.guide_officialStack.split("\n");
      expect(steps[0]).toMatch(/« \{\{service\}\} ».*« init »/);
      expect(steps[1]).toMatch(/depends_on/);
      expect(steps[1]).toMatch(/DB_HOST/);
      expect(steps[1]).toMatch(/DB_PASSWORD_FILE/);
      expect(steps[2]).toMatch(/tentacle-db/);
      expect(steps[3]).toContain("docker compose up -d --remove-orphans");
    });

    it(`${lang} : ensuite — le volume supprimé seulement une fois sûr, et l'erreur exacte d'un depends_on oublié`, () => {
      const [volumes, error] = copy.guide_officialStack_after.split("\n");
      expect(volumes).toMatch(/docker volume rm <[a-z]+>_tentacle-db/);
      expect(error).toContain('service "tentacle" depends on undefined service "{{service}}"');
      expect(copy.guide_compose).toContain("depends on undefined service");
    });

    it(`${lang} : passer à la nouvelle pile — l'une ou les deux, et ce que l'on garde`, () => {
      expect(copy.switchIntro).toContain("{{stack}}");
      expect(copy.switchIntroBoth).toMatch(/tentacle-full.*tentacle-only/);
      expect(copy.guide_officialStack_switch).toContain(".env");
      expect(copy.guide_portainer).toMatch(/Prune services/);
    });
  }
});
