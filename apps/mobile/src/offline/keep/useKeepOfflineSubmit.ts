import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { keepOffline } from "../engineApi";
import { buildKeepItem, type KeepOptions } from "../keepTargets";
import { closeKeepOffline } from "./keepOfflineStore";

let Haptics: { notificationAsync: (type: unknown) => Promise<void>; NotificationFeedbackType: { Success: unknown } } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* module natif absent */ }

export interface SpaceError {
  needed: number;
  free: number;
}

/**
 * L'envoi du dialogue : construit les entrées, met en file, et réagit —
 * succès (haptique, fermeture : le bouton d'origine passe « En préparation »
 * de lui-même), refus faute de place (cadre rouge), échec (alerte).
 */
export function useKeepOfflineSubmit(items: readonly MediaItem[], options: KeepOptions) {
  const { t } = useTranslation("offline");
  const userId = useUserId();
  const [submitting, setSubmitting] = useState(false);
  const [spaceError, setSpaceError] = useState<SpaceError | null>(null);

  const submit = useCallback(() => {
    if (userId === null || submitting || items.length === 0) return;
    setSubmitting(true);
    setSpaceError(null);
    try {
      const outcome = keepOffline(userId, items.map((item) => buildKeepItem(item, options)));
      if (!outcome.accepted) {
        setSpaceError({ needed: outcome.neededBytes, free: outcome.freeBytes });
        return;
      }
      Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      closeKeepOffline();
    } catch {
      Alert.alert(t("dialogTitle"), t("startFailed"));
    } finally {
      setSubmitting(false);
    }
  }, [userId, submitting, items, options, t]);

  return { submit, submitting, spaceError };
}
