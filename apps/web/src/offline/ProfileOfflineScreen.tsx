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
import { WifiOff } from "lucide-react";
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
      <div className="mt-16 flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line-subtle bg-fill-faint text-[var(--brand-light)]">
          <WifiOff className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-lg font-semibold text-content-primary">{t(cause.titleKey)}</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-content-tertiary">{t(cause.hintKey)}</p>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-content-tertiary">{t("profilePicker:session.offlineMessage")}</p>
      </div>
    </PageTransition>
  );
}
