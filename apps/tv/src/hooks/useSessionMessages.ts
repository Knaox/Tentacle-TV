import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useTranslation } from "react-i18next";
import { onSessionMessage, type SessionMessage } from "@tentacle-tv/api-client";

/**
 * Les messages que l'administrateur envoie à ce téléviseur (tableau de bord
 * de Jellyfin ou de Tentacle), tels que les deux téléviseurs les affichent.
 *
 * Rien ne se ferme d'un geste — un bandeau focalisable volerait le focus à ce
 * qu'on est en train de faire (le film, le menu) : un message s'efface donc
 * TOUJOURS seul, à son délai s'il en a un (borné à 3–60 s), sinon après
 * quinze secondes. Deux au plus : les plus anciens cèdent.
 */

const MIN_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_VISIBLE = 2;

export interface ShownSessionMessage extends SessionMessage {
  id: number;
  /** Le délai d'affichage retenu (borné). */
  durationMs: number;
}

export function useSessionMessages(): ShownSessionMessage[] {
  const { t } = useTranslation("sessions");
  const [messages, setMessages] = useState<ShownSessionMessage[]>([]);
  // La liste tenue hors du rendu : l'arrivée d'un message et l'échéance d'un
  // autre la lisent sans attendre qu'un rendu l'ait publiée.
  const shown = useRef<ShownSessionMessage[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  // L'annonce parle la langue du moment, sans réabonner (ni perdre les
  // échéances en cours) à chaque changement de langue.
  const announceLabel = useRef(t("messageFrom"));
  announceLabel.current = t("messageFrom");

  useEffect(() => {
    const pending = timers.current;
    const publish = (next: ShownSessionMessage[]) => {
      shown.current = next;
      setMessages(next);
    };
    const forget = (id: number) => {
      clearTimeout(pending.get(id));
      pending.delete(id);
    };
    const unsubscribe = onSessionMessage((message) => {
      seq.current += 1;
      const id = seq.current;
      const durationMs = message.timeoutMs === undefined
        ? DEFAULT_TIMEOUT_MS
        : Math.min(Math.max(message.timeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
      pending.set(id, setTimeout(() => {
        pending.delete(id);
        publish(shown.current.filter((entry) => entry.id !== id));
      }, durationMs));
      const next = [...shown.current, { ...message, id, durationMs }];
      // Ceux qui cèdent la place n'ont plus d'échéance à tenir.
      for (const dropped of next.slice(0, -MAX_VISIBLE)) forget(dropped.id);
      publish(next.slice(-MAX_VISIBLE));
      AccessibilityInfo.announceForAccessibility([announceLabel.current, message.header, message.text].filter(Boolean).join(". "));
    });
    return () => {
      unsubscribe();
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return messages;
}
