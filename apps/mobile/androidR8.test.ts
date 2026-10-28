/**
 * R8 sur la release Android : trois endroits disent la même chose et doivent
 * rester d'accord. app.json (expo-build-properties) est la source qu'un
 * prebuild relit ; android/ est commité et c'est lui que la CI construit.
 * Un prebuild qui réécrit l'un sans l'autre, ou une retouche à la main du
 * bloc généré, se voient ici avant d'arriver sur un téléphone.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mobileRoot = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(mobileRoot, path), "utf8");

type AndroidBuildProperties = {
  enableMinifyInReleaseBuilds?: boolean;
  enableShrinkResourcesInReleaseBuilds?: boolean;
  extraProguardRules?: string;
};

function buildProperties(): AndroidBuildProperties {
  const plugins = JSON.parse(read("app.json")).expo.plugins as unknown[];
  const entry = plugins.find((p) => Array.isArray(p) && p[0] === "expo-build-properties") as
    | [string, { android?: AndroidBuildProperties }]
    | undefined;
  return entry?.[1].android ?? {};
}

function gradleProperty(name: string): string | undefined {
  const line = read("android/gradle.properties")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim();
}

describe("R8 sur la release Android", () => {
  const props = buildProperties();

  it("est allumé, code ET ressources, dans app.json comme dans gradle.properties", () => {
    expect(props.enableMinifyInReleaseBuilds).toBe(true);
    expect(props.enableShrinkResourcesInReleaseBuilds).toBe(true);
    expect(gradleProperty("android.enableMinifyInReleaseBuilds")).toBe("true");
    expect(gradleProperty("android.enableShrinkResourcesInReleaseBuilds")).toBe("true");
  });

  it("le bloc généré de proguard-rules.pro est celui qu'un prebuild écrirait", () => {
    // La fonction même d'expo-build-properties : purge puis ajout du bloc.
    const require = createRequire(import.meta.url);
    const { updateAndroidProguardRules } = require("expo-build-properties/build/android") as {
      updateAndroidProguardRules: (contents: string, rules: string, mode: "append" | "overwrite") => string;
    };
    const current = read("android/app/proguard-rules.pro");
    const regenerated = updateAndroidProguardRules(
      updateAndroidProguardRules(current, "", "overwrite"),
      props.extraProguardRules ?? "",
      "append",
    );
    expect(current).toBe(regenerated);
  });

  it("garde ce que le code natif appelle par son nom", () => {
    const rules = props.extraProguardRules ?? "";
    // Observateurs de libmpv rappelés par JNI, décodeur FFmpeg chargé par réflexion,
    // modules natifs maison (services du manifeste, OptionsProvider du Cast).
    for (const kept of [
      "dev.jdtech.mpv.**",
      "androidx.media3.decoder.ffmpeg.**",
      "com.tentacle.mobile.**",
      "com.tentacletv.boot.**",
      "expo.modules.mpvplayer.**",
      "expo.modules.octaveaudio.**",
      "expo.modules.offlinestorage.**",
      "expo.modules.playerpip.**",
      "expo.modules.tentaclecast.**",
    ]) {
      expect(rules).toContain(`-keep class ${kept} { *; }`);
    }
    expect(rules).toContain("-keepattributes SourceFile,LineNumberTable");
  });
});
