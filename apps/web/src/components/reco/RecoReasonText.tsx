import { useTranslation } from "react-i18next";
import type { RecoReason } from "@tentacle-tv/api-client";

/**
 * Une raison de recommandation → une phrase. Construite depuis le
 * ScoreBreakdown du moteur : ce n'est pas cosmétique, c'est l'outil de debug
 * visuel — si la phrase est absurde, le profil l'est aussi.
 */
export function reasonToText(
  reason: RecoReason,
  t: (key: string, opts?: Record<string, unknown>) => string
): string | null {
  if (reason.kind === "seed" && reason.seedTitle) {
    return t("reasonSeed", { title: reason.seedTitle });
  }
  if (reason.kind === "exploration") {
    return t("reasonExploration");
  }
  const key = reason.key ?? "";
  const label = reason.label;
  if (key.startsWith("director:")) return label ? t("reasonDirector", { name: label }) : null;
  if (key.startsWith("actor:")) return label ? t("reasonActor", { name: label }) : null;
  if (key.startsWith("genre:")) {
    // Les libellés TMDB arrivent en ANGLAIS (« Adventure ») : les ids de genre
    // sont un petit enum stable, traduit côté i18n (fr) — la locale anglaise
    // retombe sur le libellé TMDB, déjà juste.
    const id = key.slice("genre:".length);
    const localized = t(`genreLabel_${id}`, { defaultValue: label ?? "" });
    return localized ? t("reasonGenre", { name: localized }) : null;
  }
  if (key.startsWith("genre-name:")) {
    // Genres Jellyfin : déjà dans la langue des métadonnées du serveur.
    return label ? t("reasonGenre", { name: label }) : null;
  }
  if (key.startsWith("kw:")) return label ? t("reasonTheme", { name: label }) : null;
  if (key.startsWith("studio:") || key.startsWith("studio-name:") || key.startsWith("network:")) {
    return label ? t("reasonStudio", { name: label }) : null;
  }
  if (key.startsWith("decade:")) {
    const decade = key.slice("decade:".length);
    return /^\d{4}$/.test(decade) ? t("reasonDecade", { decade }) : null;
  }
  // lang:* n'est PLUS verbalisée : « En anglais » désignait la langue
  // ORIGINALE TMDB — trompeur quand la copie en bibliothèque est doublée
  // (VF). La facette continue de peser dans le score, elle ne s'affiche plus.
  // runtime:* et facettes non libellées : trop faibles pour une phrase.
  return null;
}

/** La première raison qui fait une phrase, ou rien. */
export function RecoReasonText({ reasons }: { reasons: RecoReason[] }) {
  const { t } = useTranslation("reco");
  for (const reason of reasons) {
    const text = reasonToText(reason, t);
    if (text) {
      return <span className="line-clamp-2 text-xs text-content-secondary">{text}</span>;
    }
  }
  return null;
}
