import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { MonitorPlay } from "lucide-react";
import type { AdminPlaystateCommand, AdminSessionDto, AdminWatchGroupDto } from "@tentacle-tv/shared";
import { useToast } from "../contexts/ToastContext";
import { useAdminSessionActions, useAdminSessions, useNowTick, type MessageInput } from "../hooks/useAdminSessions";
import { SessionCard, type SessionCardActions } from "../components/admin/sessions/SessionCard";
import { IdleSessions } from "../components/admin/sessions/IdleSessions";
import { WatchGroupCard } from "../components/admin/sessions/WatchGroupCard";
import { MessageComposer } from "../components/admin/sessions/MessageComposer";
import { SessionsSummary } from "../components/admin/sessions/SessionsSummary";
import { GroupRecipient, SessionRecipient } from "../components/admin/sessions/ComposerRecipient";
import { useCommandFeedback } from "../components/admin/sessions/useCommandFeedback";
import type { CommandKind, TargetState } from "../components/admin/sessions/commandFeedback";
import { cls } from "./adminUtils";

/**
 * Sessions en direct — la vue « tableau de bord » de Jellyfin, dédiée à
 * Tentacle : qui regarde quoi, comment le média arrive, et la main pour
 * mettre en pause, arrêter ou écrire. Les salles Watch Together y ont leur
 * section : un message, un arrêt, partent à tout le groupe.
 *
 * Chaque commande est suivie jusqu'à son effet (`useCommandFeedback`) : le
 * bouton travaille, la carte dit « demandé » puis « fait », un arrêt constaté
 * s'annonce.
 */

type ComposerTarget =
  | { kind: "session"; session: AdminSessionDto }
  | { kind: "group"; group: AdminWatchGroupDto }
  | null;

function SectionTitle({ id, children }: { id: string; children: string }) {
  return <h2 id={id} className="mb-3 text-base font-semibold text-content-primary">{children}</h2>;
}

export function AdminSessions() {
  const { t } = useTranslation("sessions");
  const toast = useToast();
  const query = useAdminSessions();
  const { playstate, message, groupMessage, groupStop } = useAdminSessionActions();
  const [composer, setComposerState] = useState<ComposerTarget>(null);
  const [composerFailed, setComposerFailed] = useState(false);
  // Ouvrir (ou fermer) la rédaction repart d'une feuille sans erreur.
  const setComposer = useCallback((target: ComposerTarget) => {
    setComposerFailed(false);
    setComposerState(target);
  }, []);
  const ids = { playing: useId(), groups: useId(), idle: useId() };
  const data = query.data;

  const playing = useMemo(() => data?.sessions.filter((s) => s.nowPlaying !== null) ?? [], [data]);
  const idle = useMemo(() => data?.sessions.filter((s) => s.nowPlaying === null) ?? [], [data]);
  const sessionsById = useMemo(() => new Map((data?.sessions ?? []).map((s) => [s.id, s])), [data]);
  // Les barres n'avancent que si quelque chose lit : sinon, pas un rendu par seconde.
  const moving = playing.some((s) => !s.isPaused) || (data?.groups.some((g) => !g.isPaused) ?? false);
  // Au repos, l'heure suit au moins les relèves (les « actif il y a… »).
  const now = Math.max(useNowTick(moving), query.dataUpdatedAt);

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

  // Le nom de la cible, pour annoncer un arrêt constaté — relu à l'instant de
  // l'annonce, la session a pu changer depuis l'appui.
  const namesRef = useRef(sessionsById);
  namesRef.current = sessionsById;
  const onConfirmed = useCallback((id: string, command: CommandKind) => {
    if (command !== "Stop") return;
    const name = namesRef.current.get(id)?.userName;
    toast.show("success", name ? t("stoppedWho", { name }) : t("stopped"));
  }, [toast, t]);
  const feedback = useCommandFeedback(targets, onConfirmed);
  const { begin, accept, fail } = feedback;

  // `mutateAsync`, et non les rappels de `mutate` : ceux-là ne répondent que
  // pour le DERNIER appel d'une mutation. Deux commandes en une seconde (une
  // pause ici, un arrêt là) laissaient la première tourner sans fin.
  const sendPlaystate = playstate.mutateAsync;
  const onPlaystate = useCallback((session: AdminSessionDto, command: AdminPlaystateCommand) => {
    begin(session.id, command);
    sendPlaystate({ sessionId: session.id, command }).then(
      () => accept(session.id),
      () => {
        fail(session.id);
        toast.show("error", t("actionFailed"));
      },
    );
  }, [begin, accept, fail, sendPlaystate, toast, t]);

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
        toast.show(r.delivered > 0 ? "success" : "error", t("stoppedGroup", { count: r.delivered, delivered: r.delivered, total: r.total }));
      },
      () => {
        fail(group.groupId);
        toast.show("error", t("actionFailed"));
      },
    );
  }, [begin, accept, fail, sendGroupStop, toast, t]);

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
          toast.show("success", t("sentTo", { name: userName }));
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
        toast.show(r.delivered > 0 ? "success" : "error", t("sentGroup", { count: r.delivered, delivered: r.delivered, total: r.total }));
        done();
      },
      () => {
        fail(groupId);
        setComposerFailed(true);
      },
    );
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-content-primary">{t("title")}</h1>
          <span className={`${cls.chip} bg-status-success-bg text-status-success-fg`}>
            <span aria-hidden className="h-2 w-2 rounded-full bg-status-success" />
            {t("live")}
          </span>
        </div>
        <p className="text-sm text-content-tertiary">{t("description")}</p>
        {data && <SessionsSummary sessions={playing} />}
      </header>

      {query.isLoading && (
        <div className="grid gap-4 xl:grid-cols-2" aria-busy="true">
          <div className="h-48 rounded-xl border border-line-subtle bg-fill-faint" />
          <div className="h-48 rounded-xl border border-line-subtle bg-fill-faint" />
        </div>
      )}

      {query.isError && !data && (
        <div role="alert" className={cls.card}>
          <p className="mb-4 text-sm text-content-secondary">{t("loadError")}</p>
          <button type="button" className={cls.bs} onClick={() => void query.refetch()}>{t("retry")}</button>
        </div>
      )}

      {data && playing.length === 0 && data.groups.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line-subtle bg-fill-faint px-6 py-12 text-center">
          <MonitorPlay size={32} aria-hidden className="text-content-quaternary" />
          <p className="font-medium text-content-primary">{t("empty")}</p>
          <p className="text-sm text-content-tertiary">{t("emptyHint")}</p>
        </div>
      )}

      {data && playing.length > 0 && (
        <section aria-labelledby={ids.playing}>
          <SectionTitle id={ids.playing}>{t("sectionPlaying")}</SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">
            <AnimatePresence initial={false}>
              {playing.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  now={now}
                  clockOffsetMs={data.clockOffsetMs}
                  actions={actions}
                  feedback={feedback.entries.get(session.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {data && data.groups.length > 0 && (
        <section aria-labelledby={ids.groups}>
          <SectionTitle id={ids.groups}>{t("sectionGroups")}</SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">
            <AnimatePresence initial={false}>
              {data.groups.map((group) => (
                <WatchGroupCard
                  key={group.groupId}
                  group={group}
                  sessionsById={sessionsById}
                  now={now}
                  clockOffsetMs={data.clockOffsetMs}
                  feedback={feedback.entries.get(group.groupId)}
                  onMessage={onGroupMessage}
                  onStop={onGroupStop}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {data && idle.length > 0 && (
        <section aria-labelledby={ids.idle}>
          <SectionTitle id={ids.idle}>{t("sectionIdle")}</SectionTitle>
          <IdleSessions sessions={idle} now={now} feedback={feedback.entries} onMessage={actions.onMessage} />
        </section>
      )}

      {composer !== null && (
        <MessageComposer
          title={composer.kind === "session" ? t("composerTitle", { name: composer.session.userName }) : t("composerGroupTitle")}
          recipient={composer.kind === "session" ? <SessionRecipient session={composer.session} /> : <GroupRecipient group={composer.group} />}
          previewName={composer.kind === "session" ? composer.session.userName : null}
          pending={message.isPending || groupMessage.isPending}
          failed={composerFailed}
          onSend={send}
          onClose={() => setComposer(null)}
        />
      )}
    </div>
  );
}
