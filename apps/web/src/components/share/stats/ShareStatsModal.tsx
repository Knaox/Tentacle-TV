import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, CircleCheck, ServerCog } from "lucide-react";
import { statsShareFailure, useMyStatsShare, useRevokeStatsShare, useSaveStatsShare } from "@tentacle-tv/api-client";
import type { ViewingStatsPeriod } from "@tentacle-tv/shared";
import { Modal } from "../../ui/Modal";
import { ModalHeader } from "../../ui/ModalHeader";
import { SharePeriodPicker } from "./SharePeriodPicker";
import { StatsPrivacySummary } from "./StatsPrivacySummary";
import { StatsShareLinkPanel } from "./StatsShareLinkPanel";

interface Props {
  onClose: () => void;
  /** La période affichée par la page : celle que propose un nouveau lien. */
  defaultPeriod: ViewingStatsPeriod;
}

type Notice = { tone: "success" | "error"; text: string } | null;

const PRIMARY =
  "flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-[rgba(var(--brand-rgb),0.22)] px-4 text-sm font-semibold text-cta-brand-fg ring-1 ring-[rgba(var(--brand-rgb),0.4)] transition-transform duration-150 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50 motion-reduce:hover:scale-100";

/**
 * Un message au plus près du geste qui l'a causé — un toast passerait sous la
 * modale. `compact` : sous le choix de période, dans une zone déjà annoncée.
 */
function NoticeLine({ notice, compact = false }: { notice: Notice; compact?: boolean }) {
  if (!notice) return null;
  const Icon = notice.tone === "success" ? CircleCheck : CircleAlert;
  return (
    <p
      role={compact ? undefined : notice.tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-1.5 ${compact ? "text-xs" : "mb-3 text-sm"} ${notice.tone === "error" ? "text-status-error-fg" : "text-status-success-fg"}`}
    >
      <Icon size={15} aria-hidden className="mt-0.5 shrink-0" />
      {notice.text}
    </p>
  );
}

/**
 * « Partager mes statistiques » — la mécanique de Ma liste et de Favoris (un
 * lien, Copier, la feuille du système, Révoquer), plus ce qu'un partage de
 * statistiques demande : la PÉRIODE montrée, et ce qui devient public face à
 * ce qui reste privé, sous les yeux avant le moindre lien.
 *
 * Changer la période d'un lien existant le met à jour tout de suite (même
 * jeton, la page publique suit) et le dit. Chaque résultat se dit DANS le
 * panneau, là où l'on vient d'agir. Un serveur trop ancien, ou une base sans
 * sa colonne, se disent comme tels : rien à réessayer.
 */
export function ShareStatsModal({ onClose, defaultPeriod }: Props) {
  const { t } = useTranslation("statsShare");
  const titleId = useId();
  const mine = useMyStatsShare();
  const save = useSaveStatsShare();
  const revoke = useRevokeStatsShare();
  const [draft, setDraft] = useState<ViewingStatsPeriod>(defaultPeriod);
  const [periodNotice, setPeriodNotice] = useState<Notice>(null);
  const [linkNotice, setLinkNotice] = useState<Notice>(null);

  const link = mine.data?.token ? { token: mine.data.token, period: mine.data.period ?? defaultPeriod } : null;
  // Pendant l'enregistrement, le choix reste affiché : le lien le prendra.
  const period = link ? (save.isPending && save.variables ? save.variables : link.period) : draft;
  const periodLabel = (p: ViewingStatsPeriod) => t(`period_${p}`);
  const failure = mine.error ?? save.error;
  const outdated = failure !== null && statsShareFailure(failure) === "outdated";

  const choose = (next: ViewingStatsPeriod) => {
    if (!link) return setDraft(next);
    if (next === link.period) return;
    setPeriodNotice(null);
    save.mutate(next, {
      onSuccess: () => setPeriodNotice({ tone: "success", text: t("periodSaved", { period: periodLabel(next) }) }),
      // Un serveur à mettre à jour se dit en bas, à la place du lien : pas de « réessayez » en plus.
      onError: (err) => setPeriodNotice(statsShareFailure(err) === "outdated" ? null : { tone: "error", text: t("periodError") }),
    });
  };

  const create = () => {
    setLinkNotice(null);
    save.mutate(draft, {
      onError: (err) => setLinkNotice(statsShareFailure(err) === "outdated" ? null : { tone: "error", text: t("error") }),
    });
  };

  const onRevoke = async () => {
    try {
      await revoke.mutateAsync();
      setPeriodNotice(null);
      setLinkNotice({ tone: "success", text: t("revoked") });
    } catch {
      setLinkNotice({ tone: "error", text: t("revokeError") });
    }
  };

  let linkArea;
  if (mine.isLoading) {
    linkArea = <div className="h-12 animate-pulse rounded-lg bg-fill-subtle" />;
  } else if (outdated) {
    linkArea = (
      <p className="flex items-start gap-2 rounded-lg bg-fill-faint px-3.5 py-3 text-sm text-content-secondary">
        <ServerCog size={16} aria-hidden className="mt-0.5 shrink-0" />
        {t("outdated")}
      </p>
    );
  } else if (link) {
    linkArea = (
      <StatsShareLinkPanel
        token={link.token}
        onRevoke={onRevoke}
        revoking={revoke.isPending}
        onShareFailed={() => setLinkNotice({ tone: "error", text: t("shareFailed") })}
      />
    );
  } else {
    linkArea = (
      <button type="button" onClick={create} disabled={save.isPending} aria-busy={save.isPending || undefined} className={PRIMARY}>
        {save.isPending ? t("creating") : t("create")}
      </button>
    );
  }

  return (
    <Modal open onClose={onClose} labelledBy={titleId} maxWidth={560} className="flex max-h-[calc(100dvh-2rem)] flex-col">
      <ModalHeader title={t("title")} subtitle={t("lead")} onClose={onClose} titleId={titleId} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 pb-6 pt-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-content-primary">{t("periodLabel")}</p>
            {link && <p className="text-xs font-medium text-content-tertiary">{t("linkActive", { period: periodLabel(link.period) })}</p>}
          </div>
          <SharePeriodPicker label={t("periodLabel")} value={period} onChange={choose} labelOf={periodLabel} />
          {/* La place du message est gardée : rien ne saute quand il arrive. */}
          <div aria-live="polite" className="mt-2 min-h-5 text-xs">
            {save.isPending && link ? <span className="text-content-tertiary">{t("periodSaving")}</span> : <NoticeLine notice={periodNotice} compact />}
          </div>
        </div>
        <StatsPrivacySummary />
        <div>
          <NoticeLine notice={linkNotice} />
          {linkArea}
        </div>
      </div>
    </Modal>
  );
}
