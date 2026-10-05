// Enregistre (TRACE_MODE=record) ou vérifie (défaut) les traces du lecteur.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ANDROIDTV, effectsOf } from "./androidtv";
import { run } from "./driver";
import { IOS } from "./scenarios";

// Android TV (la refonte, seule UI depuis la bascule) se compare aux traces de
// l'Apple TV, jamais enregistré à part. L'ancien mode « android » (l'UI d'avant)
// est parti avec elle.
const mode = process.env.TRACE_PLATFORM === "androidtv" ? "androidtv" : "ios";
const platform = "ios";
const GOLDEN = path.join(process.env.TRACE_GOLDEN ?? path.join(__dirname, "golden"), platform);
const record = process.env.TRACE_MODE === "record" && mode !== "androidtv";
const list = mode === "androidtv" ? ANDROIDTV : IOS;

describe(`traces du lecteur (${mode})`, () => {
  for (const scenario of list) {
    it(`${scenario.id} — ${scenario.title}`, async () => {
      const entries = await run(scenario);
      const file = path.join(GOLDEN, `${scenario.id}.json`);
      const body = JSON.stringify({ id: scenario.id, title: scenario.title, platform, trace: entries }, null, 1);
      if (record) {
        fs.mkdirSync(GOLDEN, { recursive: true });
        fs.writeFileSync(file, `${body}\n`);
        return;
      }
      const golden = JSON.parse(fs.readFileSync(file, "utf8"));
      if (mode === "androidtv") expect(effectsOf(entries)).toEqual(effectsOf(golden.trace));
      else expect(entries).toEqual(golden.trace);
    });
  }
});
