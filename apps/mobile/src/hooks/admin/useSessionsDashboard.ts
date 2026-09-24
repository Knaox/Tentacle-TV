import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useCommandFeedback } from "@tentacle-tv/api-client";
import type {
  AdminPlaystateCommand, AdminSessionDto, AdminWatchGroupDto, CommandKind, TargetState,
} from "@tentacle-tv/shared";
import type { SessionCardActions } from "@/components/admin/sessions/SessionCard";
import { useAdminSessionActions, useAdminSessions, useNowTick, type MessageInput } from "./useAdminSessions";

export type ComposerTarget =
  | { kind: "session"; session: AdminSessionDto }
  | { kind: "group"; group: AdminWatchGroupDto }
  | null;

type Notify = (tone: "success" | "error", text: string) => void;

/**
 * Le cerveau du tableau de bord mobile — celui du bureau (`AdminSessions`),
 * au geste près : l'instantané relu tant que l'écran est devant, chaque
 * commande suivie jusqu'à son effet (`useCommandFeedback`), un arrêt constaté
 * annoncé, les messages et les arrêts de salle avec leur verdict chiffré.
 */
export function useSessionsDashboard(notify: Notify) {
  const { t } = useTranslation("sessions");
  // Derrière un autre écran, plus une relève : l'instantané attend le retour.
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const query = useAdminSessions(focused);
  const { playstate, message, groupMessage, groupStop } = useAdminSessionActions();
  const [composer, setComposerState] = useState<ComposerTarget>(null);
  const [composerFailed, setComposerFailed] = useState(false);
  // Ouvrir (ou fermer) la rédaction repart d'une feuille sans erreur.
  const setComposer = useCallback((target: ComposerTarget) => {
    setComposerFailed(false);
    setComposerState(target);
  }, []);
  const data = query.data;

  const playing = useMemo(() => data?.sessions.filter((s) => s.nowPlaying !== null) ?? [], [data]);
  const idle = useMemo(() => data?.sessions.filter((s) => s.nowPlaying === null) ?? [], [data]);
  const sessionsById = useMemo(() => new Map((data?.sessions ?? []).map((s) => [s.id, s])), [data]);
  // Les barres n'avancent que si quelque chose lit : sinon, pas un rendu par seconde.
  const moving = playing.some((s) => !s.isPaused) || (data?.groups.some((g) => !g.isPaused) ?? false);
  const now = Math.max(useNowTick(focused && moving), query.dataUpdatedAt);

  // Ce que l'instantané dit de chaque cible : c'est lui qui constate l'effet
  // d'une commande. Une salle « lit » tant qu'un de ses membres lit.
  const targets = useMemo(() => {
    const map = new Map<string, TargetState>();
    for (const s of data?.sessions ?? []) map.set(s.id, { playing: s.nowPlaying !== null, isPaused: s.isPaused });
    for (const g of data?.groups ?? []) {
      const reading = g.members.some((m) => m.sessionId !== null && sessionsById.get(m.sessionId)?.nowPlaying != null);
      map.set(g.groupId, { playing: reading, isPaused: g.isPaused });
    }
    return map;
  }, [data, sessionsById]);

  // Le nom de la cible, relu à l'instant de l'annonce : la session a pu changer depuis l'appui.
  const namesRef = useRef(sessionsById);
  namesRef.current = sessionsById;
  const onConfirmed = useCallback((id: string, command: CommandKind) => {
    if (command !== "Stop") return;
    const name = namesRef.current.get(id)?.userName;
    notify("success", name ? t("stoppedWho", { name }) : t("stopped"));
  }, [notify, t]);
  const feedback = useCommandFeedback(targets, onConfirmed);
  const { begin, accept, fail } = feedback;

  // `mutateAsync` : les rappels de `mutate` ne répondent que pour le DERNIER
  // appel — deux commandes rapprochées laissaient la première tourner sans fin.
  const sendPlaystate = playstate.mutateAsync;
  const onPlaystate = useCallback((session: AdminSessionDto, command: AdminPlaystateCommand) => {
    begin(session.id, command);
    sendPlaystate({ sessionId: session.id, command }).then(
      () => accept(session.id),
      () => {
        fail(session.id);
        notify("error", t("actionFailed"));
      },
    );
  }, [begin, accept, fail, sendPlaystate, notify, t]);

  const actions = useMemo<SessionCardActions>(() => ({
    onPlaystate,
    onMessage: (session) => setComposer({ kind: "session", session }),
  }), [onPlaystate, setComposer]);

  const onGroupMessage = useCallback((group: AdminWatchGroupDto) => setComposer({ kind: "group", group }), [setComposer]);

  const sendGroupStop = groupStop.mutateAsync;
  const onGroupStop = useCallback((group: AdminWatchGroupDto) => {
    begin(group.groupId, "Stop");
    sendGroupStop({ groupId: group.groupId }).then(
      (r) => {
        if (r.delivered > 0) accept(group.groupId);
        else fail(group.groupId);
        notify(r.delivered > 0 ? "success" : "error", t("stoppedGroup", { count: r.delivered, delivered: r.delivered, total: r.total }));
      },
      () => {
        fail(group.groupId);
        notify("error", t("actionFailed"));
      },
    );
  }, [begin, accept, fail, sendGroupStop, notify, t]);

  const send = (input: MessageInput) => {
    if (composer === null) return;
    const done = () => setComposer(null);
    setComposerFailed(false);
    if (composer.kind === "session") {
      const { id, userName } = composer.session;
      begin(id, "message");
      message.mutateAsync({ sessionId: id, input }).then(
        () => {
          accept(id);
          notify("success", t("sentTo", { name: userName }));
          done();
        },
        () => {
          fail(id);
          setComposerFailed(true);
        },
      );
      return;
    }
    const { groupId } = composer.group;
    begin(groupId, "message");
    groupMessage.mutateAsync({ groupId, input }).then(
      (r) => {
        if (r.delivered > 0) accept(groupId);
        else fail(groupId);
        notify(r.delivered > 0 ? "success" : "error", t("sentGroup", { count: r.delivered, delivered: r.delivered, total: r.total }));
        done();
      },
      () => {
        fail(groupId);
        setComposerFailed(true);
      },
    );
  };

  return {
    query, data, playing, idle, sessionsById, now, feedback, actions, onGroupMessage, onGroupStop,
    composer, setComposer, composerFailed, send, sending: message.isPending || groupMessage.isPending,
  };
}
