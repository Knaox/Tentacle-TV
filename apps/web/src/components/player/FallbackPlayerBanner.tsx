import { useState } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";

/**
 * Le bandeau qui DIT la bascule vers le lecteur de secours.
 *
 * Jusqu'ici elle était silencieuse : l'utilisateur regardait un flux transcodé
 * — sans HDR, HEVC réencodé — sans savoir qu'il avait quitté le lecteur natif,
 * ni pourquoi l'image semblait moins bonne. Un bandeau discret, fermable, posé
 * par `Watch` au-dessus de `WatchWeb` quand la session a basculé.
 *
 * Fond opaque volontaire : il flotte au-dessus de la vidéo, et un verre dépoli
 * n'a rien à flouter d'utile ici (voir la règle GPU de CLAUDE.md).
 */
export function FallbackPlayerBanner() {
  const { t } = useTranslation("player");
  const [ferme, setFerme] = useState(false);
  if (ferme) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center p-3 pointer-events-none">
      {/* Un avis posé sur la vidéo : l'encre des capsules, en dur dans les deux thèmes. */}
      <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-tile bg-[#18181B] py-2 pl-4 pr-2 text-sm text-white">
        <span className="font-semibold text-[#FCD34D]">{t("player:fallbackPlayerTitle")}</span>
        <span className="text-white/80">{t("player:fallbackPlayerHint")}</span>
        <button
          type="button"
          onClick={() => setFerme(true)}
          aria-label={t("common:close")}
          title={t("common:close")}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-pill text-white/70 transition-[background-color,color,transform] duration-hover hover:bg-white/10 hover:text-white active:scale-[0.97]"
        >
          <XIcon size={16} weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
}
