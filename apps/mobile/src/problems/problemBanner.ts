import { Linking } from "react-native";
import { router } from "expo-router";
import i18next from "i18next";
import type { ProblemActionKey, ProblemIcon, ProblemModel, ProblemSeverity } from "@tentacle-tv/shared";
import { showToast, type ToastAction, type ToastAppearance } from "@/notices/toastStore";
import { recordProblem } from "./problemJournalStore";

/**
 * Le BANDEAU discret du modèle d'erreurs — non bloquant, en haut, qui s'efface
 * seul (« Léa a quitté la séance », « Le transfert attend le Wi-Fi »). Rendu
 * par l'hôte des avertissements (`NoticeHost`), comme les messages brefs.
 * Appelable hors React (le port de Watch Together, le moteur hors ligne).
 *
 * Le bandeau dit la CAUSE (une phrase) et son aide ; le titre du contexte
 * (« La séance à plusieurs est interrompue ») ne s'y répète pas. Ses gestes :
 * ceux du modèle que la plateforme sait faire seule (réglages du système,
 * titres hors ligne) ou que l'appelant prend en charge (`onAction`).
 */

const SEVERITY: Record<ProblemSeverity, ToastAppearance["severity"]> = {
  info: "info",
  warning: "recommendation",
  error: "blocking",
};

function iconOf(icon: ProblemIcon, severity: ProblemSeverity): ToastAppearance["icon"] {
  if (icon === "wifiOff") return "wifi-off";
  if (icon === "server") return "server";
  if (icon === "lock" || icon === "user") return "key";
  if (icon === "gauge") return "activity";
  return severity === "info" ? "info" : "alert-triangle";
}

/** Ce que l'app sait faire seule, sans l'appelant. */
const BUILT_IN: Partial<Record<ProblemActionKey, () => void>> = {
  openSettings: () => void Linking.openSettings().catch(() => undefined),
  manageOffline: () => router.push("/on-device"),
};

export interface ProblemBannerOptions {
  /** Les gestes que l'appelant prend en charge (« Réessayer », « Rejoindre de nouveau »…). */
  onAction?: (key: ProblemActionKey) => void;
  /** Un titre à la place de la cause (« Ma liste n'a pas pu être modifiée ») — la cause passe dessous. */
  title?: string;
}

export function showProblemBanner(model: ProblemModel, options: ProblemBannerOptions = {}): void {
  const t = (key: string, values?: Record<string, string | number>) => i18next.t(key, values);
  const reason = t(model.reasonKey, model.values);
  const hint = model.hintKey ? t(model.hintKey, model.values) : null;
  const actions: ToastAction[] = [];
  for (const action of model.actions) {
    // Le bandeau se ferme d'un geste : « OK » n'y ajoute rien.
    if (action.key === "dismiss") continue;
    const handler = options.onAction ? () => options.onAction?.(action.key) : BUILT_IN[action.key];
    if (handler) actions.push({ label: t(action.labelKey), onPress: handler });
  }
  const lines = options.title ? [reason, hint] : [hint];
  // Un constat (info) n'a pas de code ; un échec le garde, en dernière ligne, pour le support.
  if (model.severity === "error") lines.push(t("errors:supportCode", { code: model.code }));
  recordProblem(model);
  showToast({
    title: options.title ?? reason,
    text: lines.filter(Boolean).join("\n") || undefined,
    appearance: { severity: SEVERITY[model.severity], icon: iconOf(model.icon, model.severity) },
    primary: actions[0],
    secondary: actions[1],
  });
}
