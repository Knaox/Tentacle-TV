import { useState } from "react";
import { useTranslation } from "react-i18next";

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
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-zinc-900/95 px-4 py-2 text-sm text-white ring-1 ring-white/15">
        <span className="font-semibold text-amber-300">{t("player:fallbackPlayerTitle")}</span>
        <span className="text-white/80">{t("player:fallbackPlayerHint")}</span>
        <button
          onClick={() => setFerme(true)}
          aria-label={t("common:close")}
          className="ml-1 rounded px-1.5 text-white/60 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}
