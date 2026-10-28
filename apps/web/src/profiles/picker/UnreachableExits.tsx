/**
 * « Qui regarde ? » sans serveur — les sorties (règle `pickerUnreachableExits`, offline-core) : « Continuer hors
 * ligne » (seulement si le compte de l'appareil a quelque chose de gardé ici, et jamais dans le navigateur) et
 * « Se déconnecter » (pour un autre serveur, un autre compte). « Réessayer » est le bouton de l'écran.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { CloudOff, LogOut } from "lucide-react";

export interface PickerExits {
  /** null : pas de hors ligne ici (navigateur, rien de gardé, droit refusé). */
  goOffline: (() => void) | null;
  signOut: () => void;
}

const BUTTON =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export const UnreachableExits = memo(function UnreachableExits({ exits }: { exits: PickerExits }) {
  const { t } = useTranslation("profilePicker");
  return (
    <div className="mt-6 flex flex-col items-center gap-3" data-picker-exits>
      {exits.goOffline && (
        <div className="flex flex-col items-center">
          <button type="button" onClick={exits.goOffline} className={`${BUTTON} bg-cta-primary-bg text-cta-primary-fg hover:bg-cta-primary-bg-hover`}>
            <CloudOff size={16} aria-hidden />
            {t("unreachable.goOffline")}
          </button>
          <p className="mt-1.5 text-xs text-content-tertiary">{t("unreachable.goOfflineHint")}</p>
        </div>
      )}
      <div className="flex flex-col items-center">
        <button type="button" onClick={exits.signOut} className={`${BUTTON} border border-line-subtle bg-fill-soft text-content-primary hover:bg-fill-medium`}>
          <LogOut size={16} aria-hidden />
          {t("unreachable.signOut")}
        </button>
        <p className="mt-1.5 text-xs text-content-tertiary">{t("unreachable.signOutHint")}</p>
      </div>
    </div>
  );
});
