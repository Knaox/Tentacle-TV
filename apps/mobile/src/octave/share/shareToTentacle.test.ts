/**
 * Partage système vers Tentacle TV : le natif commité (iOS, Android), ses sources (`targets/`), le config
 * plugin `withShareToTentacle`, la règle JS et la CI disent la même chose. Aucun build natif ici : ce test
 * garde le texte cohérent ; le binaire se prouve à la CI.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHARED_FILE_NAME_PARAM, SHARED_FILE_PARAM, SHARED_FILE_TYPE_PARAM, SHARED_FILES_MAX, SHARED_IMPORT_PARAM, SHARED_IMPORT_TEXT_MAX } from "@tentacle-tv/shared/octave/mode";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const require = createRequire(import.meta.url);
const android = require(join(root, "plugins/shareToTentacle/android.js")) as {
  patchMainActivity: (contents: string) => string;
  ON_CREATE: string;
  ON_NEW_INTENT: string;
  addSendFilter: (manifest: unknown) => { manifest: { application: { activity: { $: Record<string, string>; "intent-filter": { action?: { $: Record<string, string> }[] }[] }[] }[] } };
};

const KOTLIN = "android/app/src/main/java/com/tentacle/mobile";

describe("partage système : les sources natives commitées sont celles de targets/", () => {
  it("Android : ShareIntake.kt recopié tel quel", () => {
    expect(read(`${KOTLIN}/ShareIntake.kt`)).toBe(read("targets/ShareIntakeAndroid/ShareIntake.kt"));
  });

  it("iOS : l'extension recopiée telle quelle, et dans le projet Xcode", () => {
    for (const file of ["ShareViewController.swift", "Info.plist"]) expect(read(`ios/ShareToTentacle/${file}`)).toBe(read(`targets/ShareToTentacle/${file}`));
    const pbx = read("ios/TentacleTV.xcodeproj/project.pbxproj");
    expect(pbx).toMatch(/PRODUCT_BUNDLE_IDENTIFIER = "com\.tentacle\.mobile\.ShareToTentacle";/);
    expect(pbx).toMatch(/ShareToTentacle\.appex in Embed Foundation Extensions \*\/,/);
  });

  it("le natif écrit le paramètre et la borne de la règle JS", () => {
    for (const source of [read("targets/ShareIntakeAndroid/ShareIntake.kt"), read("targets/ShareToTentacle/ShareViewController.swift")]) {
      expect(source).toContain(`"${SHARED_IMPORT_PARAM}"`);
      expect(source).toContain(String(SHARED_IMPORT_TEXT_MAX));
      expect(source).toContain("octave");
    }
  });
});

describe("partage système de FICHIERS audio (lot « sf »)", () => {
  it("Android : ShareIntake écrit les paramètres et la borne de sharedReleaseFiles.ts", () => {
    const kotlin = read("targets/ShareIntakeAndroid/ShareIntake.kt");
    for (const param of [SHARED_FILE_PARAM, SHARED_FILE_NAME_PARAM, SHARED_FILE_TYPE_PARAM]) expect(kotlin).toContain(`"${param}"`);
    expect(kotlin).toContain(`FILES_MAX = ${SHARED_FILES_MAX}`);
    expect(kotlin).toContain("ACTION_SEND_MULTIPLE");
    expect(kotlin).toContain('"application/zip"');
  });

  it("Android : le filtre audio (SEND et SEND_MULTIPLE) s'ajoute une seule fois, et le manifeste commité l'a", () => {
    const manifest = { manifest: { application: [{ activity: [{ $: { "android:name": ".MainActivity" }, "intent-filter": [] }] }] } };
    android.addSendFilter(manifest);
    const out = android.addSendFilter(manifest);
    expect(out.manifest.application[0]!.activity[0]!["intent-filter"]).toHaveLength(2);
    expect(read("android/app/src/main/AndroidManifest.xml")).toMatch(/action\.SEND"\/>\s*<action android:name="android\.intent\.action\.SEND_MULTIPLE"\/>\s*<category android:name="android\.intent\.category\.DEFAULT"\/>\s*<data android:mimeType="audio\/\*"\/>/);
  });

  it("iOS : les documents audio s'ouvrent dans l'app (copiés), dans app.json comme dans le plist commité", () => {
    const plist = read("ios/TentacleTV/Info.plist");
    expect(plist).toMatch(/<key>LSItemContentTypes<\/key>\s*<array>\s*<string>public\.audio<\/string>/);
    expect(plist).toMatch(/<key>LSSupportsOpeningDocumentsInPlace<\/key>\s*<false\/>/);
    const info = JSON.parse(read("app.json")).expo.ios.infoPlist;
    expect(info.CFBundleDocumentTypes[0].LSItemContentTypes).toEqual(["public.audio", "public.zip-archive"]);
    expect(info.LSSupportsOpeningDocumentsInPlace).toBe(false);
    expect(read("app/+native-intent.tsx")).toContain("releaseFileImportPath");
  });
});

describe("partage système : le config plugin redonne le natif commité", () => {
  it("MainActivity : le plugin, appliqué au fichier d'avant (le commité sans ses ajouts), le redonne, une fois", () => {
    const committed = read(`${KOTLIN}/MainActivity.kt`);
    const before = committed.replace(android.ON_CREATE, "").replace(android.ON_NEW_INTENT, "").replace("import android.content.Intent\n", "");
    expect(before).not.toContain("ShareIntake");
    const patched = android.patchMainActivity(before);
    expect(patched).toBe(read(`${KOTLIN}/MainActivity.kt`));
    expect(android.patchMainActivity(patched)).toBe(patched);
  });

  it("le filtre SEND de texte s'ajoute une seule fois à l'activité principale", () => {
    const manifest = { manifest: { application: [{ activity: [{ $: { "android:name": ".MainActivity" }, "intent-filter": [] }] }] } };
    android.addSendFilter(manifest);
    const out = android.addSendFilter(manifest);
    const filters = out.manifest.application[0]!.activity[0]!["intent-filter"];
    // Le texte : un filtre ; les fichiers audio ont le leur (lot « sf »).
    const text = (f: (typeof filters)[number] & { data?: { $: Record<string, string> }[] }) => f.data?.some((d) => d.$["android:mimeType"] === "text/plain");
    expect(filters.filter((f) => f.action?.some((a) => a.$["android:name"] === "android.intent.action.SEND") && text(f))).toHaveLength(1);
    expect(read("android/app/src/main/AndroidManifest.xml")).toMatch(/android\.intent\.action\.SEND"\/>\s*<category android:name="android\.intent\.category\.DEFAULT"\/>\s*<data android:mimeType="text\/plain"\/>/);
  });

  it("app.json déclare le plugin", () => {
    expect(JSON.parse(read("app.json")).expo.plugins).toContain("./plugins/withShareToTentacle");
  });
});

describe("partage système : la CI signe l'extension", () => {
  it("un profil pour ShareToTentacle, sa version patchée, son export", () => {
    const ci = readFileSync(join(root, "../../.github/workflows/mobile.yml"), "utf8");
    expect(ci).toContain('IOS_SHARE_BUNDLE_ID: "com.tentacle.mobile.ShareToTentacle"');
    expect(ci).toMatch(/provision "\$IOS_SHARE_BUNDLE_ID"/);
    expect(ci).toContain("apps/mobile/ios/ShareToTentacle/Info.plist");
    expect(ci).toContain('"ShareToTentacle=$IOS_SHARE_PROFILE_NAME"');
    expect(ci).toContain("<key>${IOS_SHARE_BUNDLE_ID}</key>");
  });
});
