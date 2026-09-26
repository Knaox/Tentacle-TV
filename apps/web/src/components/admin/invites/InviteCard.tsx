import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Check, Copy, Share2, Trash2 } from "lucide-react";
import { inviteStatus, type AdminInviteDto, type InviteStatus } from "@tentacle-tv/shared";
import { cls } from "../../../pages/adminUtils";
import { StatusPill, type StatusTone } from "../kit";
import { InviteUsers } from "./InviteUsers";
import { expiresSoon, formatDateTime, relativeTime } from "./inviteFormat";

export interface InviteCardActions {
  onCopy: (invite: AdminInviteDto) => void;
  onShare: (invite: AdminInviteDto) => void;
  onDelete: (invite: AdminInviteDto) => void;
}

interface InviteCardProps extends InviteCardActions {
  invite: AdminInviteDto;
  now: number;
  /** Le lien vient d'être copié : le bouton le dit deux secondes. */
  copied: boolean;
  canShare: boolean;
  /** Tout juste créée : un halo, le temps de la repérer dans la grille. */
  highlighted: boolean;
}

/** Épuisée n'est pas un échec : elle a servi jusqu'au bout — teinte de marque, pas grise. */
const STATUS_TONE: Record<InviteStatus, StatusTone> = {
  active: "success",
  expired: "neutral",
  exhausted: "brand",
};

const ICON_BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line-subtle text-content-tertiary transition-colors";

function expiryText(invite: AdminInviteDto, now: number, locale: string, t: TFunction<"adminInvites">): string {
  if (invite.expiresAt === null) return t("neverExpires");
  const at = Date.parse(invite.expiresAt);
  const when = relativeTime(at, now, locale);
  if (at > now) return when ? t("expiresIn", { when }) : t("expiresUnderMinute");
  return when ? t("expiredAgo", { when }) : t("expiredJustNow");
}

function createdText(invite: AdminInviteDto, now: number, locale: string, t: TFunction<"adminInvites">): string {
  // Une horloge serveur en avance ne doit pas dater la création « dans 2 minutes ».
  const when = relativeTime(Math.min(Date.parse(invite.createdAt), now), now, locale);
  const name = invite.createdBy;
  if (when) return name ? t("createdAgoBy", { when, name }) : t("createdAgo", { when });
  return name ? t("createdJustNowBy", { name }) : t("createdJustNow");
}

function UsesMeter({ invite, active }: { invite: AdminInviteDto; active: boolean }) {
  const { t } = useTranslation("adminInvites");
  if (invite.maxUses === 1) {
    return (
      <p className="text-sm text-content-secondary">
        {invite.currentUses > 0 ? t("usesSingleUsed") : t("usesSingleUnused")}
      </p>
    );
  }
  const ratio = Math.min(1, invite.currentUses / invite.maxUses);
  return (
    <div>
      <p className="text-sm tabular-nums text-content-secondary">
        {t("usesCount", { current: invite.currentUses, max: invite.maxUses })}
      </p>
      <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill-soft">
        <div
          className={`h-full rounded-full ${active ? "bg-[var(--brand)]" : "bg-content-quaternary"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Une invitation : sa clé et son statut, ce qu'il en reste, son échéance,
 * qui l'a créée et quels comptes elle a ouverts. Les actions s'alignent en
 * pied de carte, d'une carte à l'autre de la grille.
 */
export const InviteCard = memo(function InviteCard({
  invite, now, copied, canShare, highlighted, onCopy, onShare, onDelete,
}: InviteCardProps) {
  const { t, i18n } = useTranslation("adminInvites");
  const locale = i18n.language;
  const status = inviteStatus(invite, now);
  const active = status === "active";
  const soon = active && expiresSoon(invite, now);

  return (
    <article className="relative flex h-full flex-col gap-3 rounded-xl border border-line-subtle bg-fill-faint p-4 transition-colors hover:border-line-strong">
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-xl border-2 border-[var(--brand)] transition-opacity duration-700"
        style={{ opacity: highlighted ? 1 : 0 }}
      />

      <div className="flex items-center justify-between gap-3">
        <code className={`truncate font-mono text-[13px] ${active ? "text-content-primary" : "text-content-tertiary"}`}>
          {invite.key}
        </code>
        <StatusPill tone={STATUS_TONE[status]} size="sm">{t(`status_${status}`)}</StatusPill>
      </div>

      <UsesMeter invite={invite} active={active} />

      <div className="space-y-0.5 text-xs text-content-quaternary">
        {/* Épuisée, son échéance ne dit plus rien. */}
        {status !== "exhausted" && (
          <p
            title={invite.expiresAt ? formatDateTime(Date.parse(invite.expiresAt), locale) : undefined}
            className={soon ? "font-medium text-status-warning-fg" : undefined}
          >
            {expiryText(invite, now, locale, t)}
          </p>
        )}
        <p title={formatDateTime(Date.parse(invite.createdAt), locale)}>{createdText(invite, now, locale, t)}</p>
      </div>

      <InviteUsers usages={invite.usages} />

      <div className="mt-auto flex items-center gap-2 pt-1">
        {active ? (
          <button type="button" onClick={() => onCopy(invite)} className={`${cls.bs} min-w-0 flex-1 px-3`}>
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            <span className="truncate" aria-live="polite">{copied ? t("copied") : t("copyLink")}</span>
          </button>
        ) : (
          <span className="flex-1" />
        )}
        {active && canShare && (
          <button
            type="button"
            onClick={() => onShare(invite)}
            aria-label={t("share")}
            title={t("share")}
            className={`${ICON_BUTTON} hover:bg-fill-soft hover:text-content-primary`}
          >
            <Share2 size={16} aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(invite)}
          aria-label={t("deleteLabel", { key: invite.key })}
          title={t("deleteConfirm")}
          className={`${ICON_BUTTON} hover:border-danger-border hover:bg-danger-surface hover:text-status-error-fg`}
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </article>
  );
});
