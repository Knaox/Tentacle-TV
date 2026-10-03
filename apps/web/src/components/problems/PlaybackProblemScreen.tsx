import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { ProblemActionKey, ProblemModel } from "@tentacle-tv/shared";
import { ProblemPanel } from "./ProblemPanel";

interface Props {
  model: ProblemModel;
  posterUrl?: string;
  title?: string;
  subtitle?: string;
  onAction: (key: ProblemActionKey) => void;
  /** La sortie de l'écran (Échap, « Retour ») : la même que « Retour à la fiche ». */
  onBack: () => void;
}

/**
 * L'échec d'une lecture, en plein écran — l'écran d'ouverture du titre quand
 * elle n'aboutit pas, comme sur l'Apple TV et le mobile : son image assombrie,
 * son titre et l'épisode, puis le message (quoi, pourquoi, quoi faire,
 * détails) en bas à gauche, et « Retour » en haut. Le lecteur reste sombre
 * quel que soit le thème (couleurs en dur, comme `PlayerLoadingScreen`). Le
 * geste principal prend le focus : Entrée suffit, au clavier comme à la
 * télécommande.
 */
export function PlaybackProblemScreen({ model, posterUrl, title, subtitle, onAction, onBack }: Props) {
  const { t } = useTranslation("player");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onBack(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a12] fade-in-on-mount">
      {posterUrl && (
        <img src={posterUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {/* Plus sombre que l'attente : le message se lit sur l'image. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/55" />

      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-4 z-20 flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-black/45 px-5 text-sm font-semibold text-white transition-colors hover:bg-black/70 md:left-8 md:top-8"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t("player:back")}
      </button>

      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-end gap-5 px-6 pb-10 pt-24 md:px-16 md:pb-16">
          <div aria-hidden="true">
            {title && <p className="max-w-3xl truncate text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</p>}
            {subtitle && <p className="mt-1 max-w-3xl truncate text-sm text-white/55 md:text-base">{subtitle}</p>}
          </div>
          <ProblemPanel model={model} tone="player" onAction={onAction} autoFocus />
        </div>
      </div>
    </div>
  );
}
