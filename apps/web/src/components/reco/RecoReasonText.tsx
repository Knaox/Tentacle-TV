import { useTranslation } from "react-i18next";
import type { RecoReason } from "@tentacle-tv/api-client";

/**
 * Une raison de recommandation → une phrase. Construite depuis le
 * ScoreBreakdown du moteur : ce n'est pas cosmétique, c'est l'outil de debug
 * visuel — si la phrase est absurde, le profil l'est aussi.
 */
export function reasonToText(
  reason: RecoReason,
  t: (key: string, opts?: Record<string, unknown>) => string,
  language: string
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
  if (key.startsWith("lang:")) {
    const code = key.slice("lang:".length);
    try {
      const name = new Intl.DisplayNames([language], { type: "language" }).of(code);
      return name ? t("reasonLanguage", { name }) : null;
    } catch {
      return null;
    }
  }
  // runtime:* et facettes non libellées : trop faibles pour une phrase.
  return null;
}

/** La première raison qui fait une phrase, ou rien. */
export function RecoReasonText({ reasons }: { reasons: RecoReason[] }) {
  const { t, i18n } = useTranslation("reco");
  for (const reason of reasons) {
    const text = reasonToText(reason, t, i18n.language);
    if (text) {
      return <span className="line-clamp-2 text-xs text-content-secondary">{text}</span>;
    }
  }
  return null;
}
