/**
 * L'accueil hors ligne de la session d'un PROFIL (bureau).
 *
 * Rien n'est gardé sur la machine pour un profil — le serveur lui refuse les
 * téléchargements, et le contenu gardé est celui du compte —, donc pas de
 * catalogue local : la cause, dans les mots partagés de la règle de
 * connectivité (`connectivityCase.ts`, les mêmes que la pastille et le message
 * de bascule), puis ce qui va se passer. Ni « Sur cet appareil », ni
 * « Gérer les téléchargements » : aucune trace du contenu du compte.
 */

import { useTranslation } from "react-i18next";
import { WifiSlashIcon as WifiOff } from "@phosphor-icons/react/dist/csr/WifiSlash";
import { connectivityCaseOf, connectivityCopy } from "@tentacle-tv/shared";
import { PageTransition } from "../components/PageTransition";
import { useConnectivity } from "./useConnectivity";

export function ProfileOfflineScreen() {
  const { t } = useTranslation(["errors", "profilePicker"]);
  const { reason } = useConnectivity();
  // Sans cause mesurée (sonde pas encore revenue), le cas le plus probable,
  // comme la pastille de la barre.
  const cause = connectivityCopy(connectivityCaseOf(reason) ?? "server");
  return (
    <PageTransition className="px-4 pb-24 pt-10 md:px-8">
      <div className="mt-16 flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-tile bg-surface-2 text-content-secondary">
          <WifiOff size={26} aria-hidden />
        </span>
        <h1 className="font-display text-heading-3 text-content-primary">{t(cause.titleKey)}</h1>
        <p className="max-w-[52ch] text-sm leading-relaxed text-content-secondary">{t(cause.hintKey)}</p>
        <p className="max-w-[52ch] text-sm leading-relaxed text-content-secondary">{t("profilePicker:session.offlineMessage")}</p>
      </div>
    </PageTransition>
  );
}
