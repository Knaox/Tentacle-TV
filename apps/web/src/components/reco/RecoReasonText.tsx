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
  if (key.startsWith("genre:") || key.startsWith("genre-name:")) {
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
