import type { SetupDocTopic } from "./setupDocLinks";
import type { SetupStep } from "./setupFlowContract";
import type { SetupPackaging } from "./setupPackagingContract";

/**
 * « Besoin d'aide ? », repliable, au pied de chaque écran de l'assistant :
 * quelques questions-réponses courtes (clés i18n `help_<étape>_<id>_q` et
 * `_a`, espace `setupWizard`) et la page du site qui en dit plus
 * (`setupDocLinks.ts`). La même liste pour le web, le bureau et le miroir.
 */
export const SETUP_HELP: Readonly<Record<SetupStep, readonly string[]>> = {
  welcome: ["what", "time"],
  code: ["where", "why"],
  jellyfin: ["kinds", "missing"],
  account: ["which", "stored"],
  signIn: ["which", "forgot"],
  libraries: ["what", "missing", "windows"],
  recommended: ["all", "restart"],
  tmdb: ["what", "free", "later"],
  recap: ["what", "clientUrl"],
  apply: ["what", "failed"],
  remote: ["needed", "proxy", "nothing"],
  done: ["missing", "reopen"],
};

/**
 * La page d'aide d'un écran : celle des bibliothèques d'un Jellyfin configuré
 * vide a son ancre ; `null` : l'écran n'a pas (encore) de page sur le site.
 * Dans l'app Windows, l'accueil et le code renvoient à la page de l'app (le
 * premier lancement, l'icône et son « Code d'installation ») plutôt qu'à
 * celle du code, qui parle de Docker.
 */
export function setupHelpTopic(step: SetupStep, noLibraries: boolean, packaging: SetupPackaging | null = null): SetupDocTopic | null {
  if (step === "tmdb") return null;
  if (packaging === "windows-app" && (step === "welcome" || step === "code")) return "windows";
  return step === "libraries" && noLibraries ? "librariesExistingEmpty" : step;
}
