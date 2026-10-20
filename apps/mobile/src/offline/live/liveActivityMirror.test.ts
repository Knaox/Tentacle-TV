/**
 * La Live Activity d'iOS tient à trois copies qui doivent rester d'accord :
 * l'état décrit dans l'extension de widget, celui du module natif, et ce que
 * le JavaScript envoie. Le projet iOS est COMMITÉ (la CI ne fait pas de
 * prebuild) : il doit porter l'extension telle que le plugin la pose.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mobile = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(join(mobile, path), "utf8");
const { SOURCES, TARGET } = (await import(join(mobile, "plugins/withTransferLiveActivity.js"))) as {
  SOURCES: string[];
  TARGET: string;
};

/** Les clés que `liveSurface.ts` envoie (`LiveActivityState`). */
const SENT_KEYS = ["headline", "status", "readyInLabel", "phase", "fraction", "endsAtMs", "deepLink"];

describe("Live Activity des transferts", () => {
  it("l'état est le MÊME dans le module natif et dans l'extension", () => {
    expect(read("modules/offline-storage/ios/TransferActivityAttributes.swift")).toBe(
      read(`targets/${TARGET}/TransferActivityAttributes.swift`),
    );
  });

  it("le module natif lit chaque clé que le JavaScript envoie", () => {
    const bridge = read("modules/offline-storage/ios/LiveActivityBridge.swift");
    for (const key of SENT_KEYS) expect(bridge).toContain(`raw["${key}"]`);
    const index = read("modules/offline-storage/index.ts");
    for (const key of SENT_KEYS) expect(index).toMatch(new RegExp(`\\n  ${key}: `));
  });

  it("le projet iOS commité porte les sources à jour de l'extension", () => {
    for (const file of [...SOURCES, "Info.plist"]) {
      expect(read(`ios/${TARGET}/${file}`), file).toBe(read(`targets/${TARGET}/${file}`));
    }
    const project = read("ios/TentacleTV.xcodeproj/project.pbxproj");
    expect(project).toContain(`PRODUCT_BUNDLE_IDENTIFIER = com.tentacle.mobile.${TARGET};`);
    expect(project).toContain("Embed Foundation Extensions");
    expect(read("ios/TentacleTV/Info.plist")).toMatch(/<key>NSSupportsLiveActivities<\/key>\s*<true\/>/);
  });

  it("le plugin est déclaré dans app.json", () => {
    expect(JSON.parse(read("app.json")).expo.plugins).toContain(`./plugins/with${TARGET}`);
  });
});
