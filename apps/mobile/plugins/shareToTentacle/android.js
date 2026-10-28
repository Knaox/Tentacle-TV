/**
 * Partage système vers Tentacle TV — la moitié ANDROID du config plugin `withShareToTentacle` :
 * l'activité principale reçoit l'intent `SEND` (texte) et le réécrit en lien profond
 * `tentacle://octave/import?shared=<texte>` (`ShareIntake.kt`, source dans `targets/ShareIntakeAndroid/`).
 * Le projet Android est COMMITÉ (la CI ne fait pas de prebuild) : ce plugin garde `expo prebuild` cohérent
 * avec lui. Idempotent : rien n'est posé deux fois.
 */

const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod, withMainActivity } = require("@expo/config-plugins");

const SOURCE = "ShareIntake.kt";
const ON_CREATE = `    // Partage système vers Tentacle TV (withShareToTentacle) : avant que React Native ne lise l'intent.
    ShareIntake.rewrite(intent)
`;
const ON_NEW_INTENT = `  // Partage système vers Tentacle TV (withShareToTentacle) : l'app déjà ouverte reçoit le lien par \`url\`.
  override fun onNewIntent(intent: Intent) {
    ShareIntake.rewrite(intent)
    super.onNewIntent(intent)
  }

`;

/** Le filtre `SEND` de texte sur l'activité principale (jamais deux). */
function addSendFilter(manifest) {
  const activity = manifest.manifest.application?.[0]?.activity?.find((a) => a.$["android:name"] === ".MainActivity");
  if (!activity) throw new Error("withShareToTentacle : .MainActivity introuvable.");
  activity["intent-filter"] ??= [];
  const has = activity["intent-filter"].some((f) => f.action?.some((a) => a.$["android:name"] === "android.intent.action.SEND"));
  if (!has) {
    activity["intent-filter"].push({
      action: [{ $: { "android:name": "android.intent.action.SEND" } }],
      category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
      data: [{ $: { "android:mimeType": "text/plain" } }],
    });
  }
  return manifest;
}

/** Les deux appels de `ShareIntake` dans `MainActivity.kt` (Kotlin seulement). */
function patchMainActivity(contents) {
  let out = contents;
  if (!out.includes("import android.content.Intent")) out = out.replace("import android.os.Build", "import android.content.Intent\nimport android.os.Build");
  if (!out.includes(ON_CREATE)) {
    out = out.replace(/(override fun onCreate\(savedInstanceState: Bundle\?\) \{\n)/, `$1${ON_CREATE}`);
  }
  if (!out.includes("override fun onNewIntent")) {
    out = out.replace(/(  \/\*\*\n   \* Returns the name of the main component)/, `${ON_NEW_INTENT}$1`);
  }
  if (!out.includes(ON_CREATE) || !out.includes("override fun onNewIntent")) throw new Error("withShareToTentacle : MainActivity.kt n'a pas la forme attendue.");
  return out;
}

function withShareToTentacleAndroid(config) {
  const pkg = config.android?.package;
  if (!pkg) throw new Error("withShareToTentacle : android.package manquant.");
  config = withAndroidManifest(config, (mod) => {
    mod.modResults = addSendFilter(mod.modResults);
    return mod;
  });
  config = withMainActivity(config, (mod) => {
    if (mod.modResults.language !== "kt") throw new Error("withShareToTentacle : MainActivity en Kotlin attendue.");
    mod.modResults.contents = patchMainActivity(mod.modResults.contents);
    return mod;
  });
  // ShareIntake.kt vit dans le paquet de l'activité (`com.tentacle.mobile`, pas celui de l'application).
  return withDangerousMod(config, [
    "android",
    (mod) => {
      const main = path.join(mod.modRequest.platformProjectRoot, "app/src/main/java/com/tentacle/mobile");
      fs.mkdirSync(main, { recursive: true });
      fs.copyFileSync(path.join(mod.modRequest.projectRoot, "targets/ShareIntakeAndroid", SOURCE), path.join(main, SOURCE));
      return mod;
    },
  ]);
}

module.exports = withShareToTentacleAndroid;
module.exports.addSendFilter = addSendFilter;
module.exports.patchMainActivity = patchMainActivity;
module.exports.ON_CREATE = ON_CREATE;
module.exports.ON_NEW_INTENT = ON_NEW_INTENT;
