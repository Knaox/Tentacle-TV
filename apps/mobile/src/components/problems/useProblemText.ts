import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ComponentProps } from "react";
import type { Feather } from "@expo/vector-icons";
import {
  detailText, problemCopyText,
  type ProblemActionKey, type ProblemIcon, type ProblemModel,
} from "@tentacle-tv/shared";

type FeatherName = ComponentProps<typeof Feather>["name"];

/** Le vocabulaire d'icônes du modèle, dessiné par Feather. */
export const PROBLEM_ICONS: Record<ProblemIcon, FeatherName> = {
  wifiOff: "wifi-off",
  server: "server",
  shield: "shield",
  lock: "lock",
  user: "user",
  file: "file",
  film: "film",
  subtitles: "type",
  gauge: "activity",
  clock: "clock",
  users: "users",
  puzzle: "package",
  alert: "alert-triangle",
};

export interface ProblemText {
  title: string;
  reason: string;
  hint: string | null;
  actions: { key: ProblemActionKey; label: string }[];
  details: string[];
  /** Ce que « Copier » met dans le presse-papiers. */
  copy: string;
  /** Ce que dit le lecteur d'écran à l'arrivée du message. */
  announcement: string;
}

/** Le modèle, mis en mots dans la langue de l'interface. */
export function useProblemText(model: ProblemModel): ProblemText {
  const { t } = useTranslation("errors");
  return useMemo(() => {
    const tr = (key: string, values?: Record<string, string | number>) => t(key, values);
    const title = tr(model.titleKey);
    const reason = tr(model.reasonKey, model.values);
    const hint = model.hintKey ? tr(model.hintKey, model.values) : null;
    return {
      title,
      reason,
      hint,
      actions: model.actions.map((action) => ({ key: action.key, label: tr(action.labelKey) })),
      details: model.details.map((detail) => detailText(detail, tr)),
      copy: problemCopyText(model, tr),
      announcement: [title, reason, hint].filter(Boolean).join(" "),
    };
  }, [model, t]);
}
