import type { ServerInstall } from "../serverUpdate/serverUpdateContract";
import type { SetupPackaging } from "../setupWizard/setupPackagingContract";

/**
 * Les aides qui supposent Docker, et ce qu'elles deviennent dans l'app
 * Windows « Tentacle Server » (`packaging: "windows-app"`) : pas de conteneur,
 * pas de Portainer, pas de `docker logs`, mais une icône dans la zone de
 * notification, l'alias `tentacle` et le Microsoft Store.
 *
 * UNE liste fermée, par espace i18n : `variant` — la clé `<clé>_windowsApp`
 * remplace la phrase ; `hidden` — la phrase n'a pas lieu d'être (elle se
 * tait). Toute autre clé reste telle quelle. Un serveur qui ne dit rien de sa
 * livraison (image Docker, installation à la main, serveur d'avant) garde les
 * phrases d'avant : `packaging` absent ne change rien.
 *
 * Une aide de plus qui parle de Docker : sa variante ici, ses mots en FR et
 * en EN (`packagedHelp.test.ts` vérifie que chaque variante existe).
 */

/** `null` ou `undefined` : image Docker, installation à la main, ou serveur qui ne le dit pas. */
export type HelpPackaging = SetupPackaging | null | undefined;

export type PackagedHelpTreatment = "variant" | "hidden";

export const WINDOWS_APP_SUFFIX = "_windowsApp";

export const WINDOWS_APP_HELP = {
  setupWizard: {
    codeHelp_intro: "variant",
    codeWhereFile: "variant",
    help_code_where_a: "variant",
    help_jellyfin_missing_a: "variant",
    help_libraries_missing_a: "variant",
    help_done_reopen_a: "variant",
    doneWebUiOff: "variant",
  },
  remoteAccess: { tentacleUpstreamHint: "variant" },
  // Docker Desktop perd l'adresse des visiteurs : l'app Windows n'a pas ce défaut.
  remoteAccessHelp: { choose_p2: "variant", ports_p4: "hidden" },
  adminPlugins: { restartStuckBody: "variant", restartConfirmBody: "variant" },
  adminServices: { jellyfinUrlHint: "variant", audioUnavailable: "variant" },
  trailerHelp: { stepUpdateAppleTv: "variant" },
} as const satisfies Readonly<Record<string, Readonly<Record<string, PackagedHelpTreatment>>>>;

export type PackagedHelpNamespace = keyof typeof WINDOWS_APP_HELP;

function treatmentOf(namespace: PackagedHelpNamespace, key: string): PackagedHelpTreatment | undefined {
  const keys: Readonly<Record<string, PackagedHelpTreatment>> = WINDOWS_APP_HELP[namespace];
  return Object.prototype.hasOwnProperty.call(keys, key) ? keys[key] : undefined;
}

/** La phrase se tait pour cette livraison (`hidden`). */
export function isHelpHidden(namespace: PackagedHelpNamespace, key: string, packaging: HelpPackaging): boolean {
  return packaging === "windows-app" && treatmentOf(namespace, key) === "hidden";
}

/** La clé à dire pour cette livraison : sa variante, ou elle-même (`isHelpHidden` dit si elle se tait). */
export function packagedHelpKey(namespace: PackagedHelpNamespace, key: string, packaging: HelpPackaging): string {
  if (packaging !== "windows-app") return key;
  return treatmentOf(namespace, key) === "variant" ? `${key}${WINDOWS_APP_SUFFIX}` : key;
}

/** Une suite de paragraphes (un guide) : chacun dans sa variante, ceux qui se taisent retirés. */
export function packagedHelpKeys(namespace: PackagedHelpNamespace, keys: readonly string[], packaging: HelpPackaging): string[] {
  return keys.filter((key) => !isHelpHidden(namespace, key, packaging)).map((key) => packagedHelpKey(namespace, key, packaging));
}

/**
 * La livraison lue sur la carte « Serveur Tentacle » (`/api/admin/server-update`),
 * pour les pages d'administration qui n'ont pas d'autre source : seule l'app
 * Windows est mise à jour par le Microsoft Store.
 */
export function packagingOfInstall(install: Pick<ServerInstall, "channel"> | null | undefined): SetupPackaging | null {
  return install?.channel === "microsoft-store" ? "windows-app" : null;
}
