import { useCallback, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MonitorPlay } from "lucide-react";
import type { AdminPlaystateCommand, AdminSessionDto, AdminWatchGroupDto } from "@tentacle-tv/shared";
import { useToast } from "../contexts/ToastContext";
import { useAdminSessionActions, useAdminSessions, useNowTick, type MessageInput } from "../hooks/useAdminSessions";
import { SessionCard, type SessionCardActions } from "../components/admin/sessions/SessionCard";
import { IdleSessions } from "../components/admin/sessions/IdleSessions";
import { WatchGroupCard } from "../components/admin/sessions/WatchGroupCard";
import { MessageComposer } from "../components/admin/sessions/MessageComposer";
import { SessionsSummary } from "../components/admin/sessions/SessionsSummary";
import { cls } from "./adminUtils";

/**
 * Sessions en direct — la vue « tableau de bord » de Jellyfin, dédiée à
 * Tentacle : qui regarde quoi, comment le média arrive, et la main pour
 * mettre en pause, arrêter ou écrire. Les salles Watch Together y ont leur
 * section : un message, un arrêt, partent à tout le groupe.
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
  const [composer, setComposer] = useState<ComposerTarget>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const ids = { playing: useId(), groups: useId(), idle: useId() };
  const data = query.data;

  const playing = useMemo(() => data?.sessions.filter((s) => s.nowPlaying !== null) ?? [], [data]);
  const idle = useMemo(() => data?.sessions.filter((s) => s.nowPlaying === null) ?? [], [data]);
  const sessionsById = useMemo(() => new Map((data?.sessions ?? []).map((s) => [s.id, s])), [data]);
  // Les barres n'avancent que si quelque chose lit : sinon, pas un rendu par seconde.
  const moving = playing.some((s) => !s.isPaused) || (data?.groups.some((g) => !g.isPaused) ?? false);
  // Au repos, l'heure suit au moins les relèves (les « actif il y a… »).
  const now = Math.max(useNowTick(moving), query.dataUpdatedAt);

  const onPlaystate = useCallback((session: AdminSessionDto, command: AdminPlaystateCommand) => {
    setPendingId(session.id);
    playstate.mutate({ sessionId: session.id, command }, {
      onSuccess: () => { if (command === "Stop") toast.show("success", t("stopped")); },
      onError: () => toast.show("error", t("actionFailed")),
      onSettled: () => setPendingId(null),
    });
  }, [playstate, toast, t]);

  const actions = useMemo<SessionCardActions>(() => ({
    onPlaystate,
    onMessage: (session) => setComposer({ kind: "session", session }),
    pendingId,
  }), [onPlaystate, pendingId]);

  const onGroupMessage = useCallback((group: AdminWatchGroupDto) => setComposer({ kind: "group", group }), []);

  const onGroupStop = useCallback((group: AdminWatchGroupDto) => {
    setPendingId(group.groupId);
    groupStop.mutate({ groupId: group.groupId }, {
      onSuccess: (r) => toast.show(r.delivered > 0 ? "success" : "error", t("stoppedGroup", { count: r.delivered, delivered: r.delivered, total: r.total })),
      onError: () => toast.show("error", t("actionFailed")),
      onSettled: () => setPendingId(null),
    });
  }, [groupStop, toast, t]);

  const send = (input: MessageInput) => {
    if (composer === null) return;
    const done = () => setComposer(null);
    if (composer.kind === "session") {
      message.mutate({ sessionId: composer.session.id, input }, {
        onSuccess: () => { toast.show("success", t("sent")); done(); },
        onError: () => toast.show("error", t("actionFailed")),
      });
      return;
    }
    groupMessage.mutate({ groupId: composer.group.groupId, input }, {
      onSuccess: (r) => {
        toast.show(r.delivered > 0 ? "success" : "error", t("sentGroup", { count: r.delivered, delivered: r.delivered, total: r.total }));
        done();
      },
      onError: () => toast.show("error", t("actionFailed")),
    });
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
            {playing.map((session) => (
              <SessionCard key={session.id} session={session} now={now} clockOffsetMs={data.clockOffsetMs} actions={actions} />
            ))}
          </div>
        </section>
      )}

      {data && data.groups.length > 0 && (
        <section aria-labelledby={ids.groups}>
          <SectionTitle id={ids.groups}>{t("sectionGroups")}</SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">
            {data.groups.map((group) => (
              <WatchGroupCard
                key={group.groupId}
                group={group}
                sessionsById={sessionsById}
                now={now}
                clockOffsetMs={data.clockOffsetMs}
                pending={pendingId === group.groupId}
                onMessage={onGroupMessage}
                onStop={onGroupStop}
              />
            ))}
          </div>
        </section>
      )}

      {data && idle.length > 0 && (
        <section aria-labelledby={ids.idle}>
          <SectionTitle id={ids.idle}>{t("sectionIdle")}</SectionTitle>
          <IdleSessions sessions={idle} now={now} onMessage={actions.onMessage} />
        </section>
      )}

      {composer !== null && (
        <MessageComposer
          title={composer.kind === "session" ? t("composerTitle", { name: composer.session.userName }) : t("composerGroupTitle")}
          pending={message.isPending || groupMessage.isPending}
          onSend={send}
          onClose={() => setComposer(null)}
        />
      )}
    </div>
  );
}
