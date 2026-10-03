import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle, Activity, Captions, Clock, File, Film, Lock, Package, Server, Shield, User, Users, WifiOff,
  type LucideIcon,
} from "lucide-react";
import {
  detailText, problemCopyText,
  type ProblemActionKey, type ProblemIcon, type ProblemModel,
} from "@tentacle-tv/shared";

/** Le vocabulaire d'icônes du modèle, dessiné par Lucide (le jeu du web). */
export const PROBLEM_ICONS: Record<ProblemIcon, LucideIcon> = {
  wifiOff: WifiOff,
  server: Server,
  shield: Shield,
  lock: Lock,
  user: User,
  file: File,
  film: Film,
  subtitles: Captions,
  gauge: Activity,
  clock: Clock,
  users: Users,
  puzzle: Package,
  alert: AlertTriangle,
};

export interface ProblemText {
  title: string;
  reason: string;
  hint: string | null;
  actions: { key: ProblemActionKey; label: string }[];
  details: string[];
  /** Ce que « Copier » met dans le presse-papiers. */
  copy: string;
}

/** Le modèle, mis en mots dans la langue de l'interface — même lecture que le mobile. */
export function useProblemText(model: ProblemModel): ProblemText {
  const { t } = useTranslation("errors");
  return useMemo(() => {
    const tr = (key: string, values?: Record<string, string | number>) => t(key, values);
    return {
      title: tr(model.titleKey),
      reason: tr(model.reasonKey, model.values),
      hint: model.hintKey ? tr(model.hintKey, model.values) : null,
      actions: model.actions.map((action) => ({ key: action.key, label: tr(action.labelKey) })),
      details: model.details.map((detail) => detailText(detail, tr)),
      copy: problemCopyText(model, tr),
    };
  }, [model, t]);
}
