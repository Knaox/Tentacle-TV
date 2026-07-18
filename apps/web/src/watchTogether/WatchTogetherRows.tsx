import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { WtInviteDto, WtMemberDto } from "@tentacle-tv/shared";
import { getBackendBase } from "../lib/backendBase";

/** Watch Together — briques partagées : avatar, ligne membre, ligne invitation. */

const RING_COLORS = ["#8b5cf6", "#ec4899", "#6366f1", "#a855f7", "#f472b6", "#7c3aed"];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return RING_COLORS[Math.abs(hash) % RING_COLORS.length];
}

export function avatarUrl(userId: string): string {
  const base = getBackendBase().replace(/\/$/, "");
  return `${base}/api/jellyfin/Users/${userId}/Images/Primary?maxWidth=64&quality=90`;
}

export type WtAvatarStatus = "none" | "watching" | "buffering" | "error" | "offline";

const STATUS_RING: Record<Exclude<WtAvatarStatus, "none">, string> = {
  watching: "#34d399",
  buffering: "#fbbf24",
  error: "#f87171",
  offline: "rgba(255,255,255,0.25)",
};

// Couleurs volontairement en dur : WtAvatar est partagé avec des contextes
// toujours sombres (overlay lecteur, bulle/toasts de chat flottants) où le
// texte doit rester blanc quel que soit le thème — un token clair y casserait
// le contraste.
export function WtAvatar({
  userId, name, hasAvatar = true, size = 32, status = "none",
}: {
  userId: string;
  name: string;
  hasAvatar?: boolean;
  size?: number;
  status?: WtAvatarStatus;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = hasAvatar && !failed;
  const ring = status !== "none" ? STATUS_RING[status] : "rgba(255,255,255,0.15)";
  const dimmed = status === "offline";
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${status === "buffering" ? "animate-pulse" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: showImage ? "rgba(255,255,255,0.08)" : colorFor(name),
        boxShadow: `0 0 0 2px ${ring}`,
        opacity: dimmed ? 0.45 : 1,
      }}
      title={name}
    >
      {showImage ? (
        <img
          src={avatarUrl(userId)}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

export function memberStatus(m: WtMemberDto): WtAvatarStatus {
  if (!m.online) return "offline";
  if (m.playbackError) return "error";
  if (m.buffering) return "buffering";
  if (m.inPlayback) return "watching";
  return "none";
}

export function MemberRow({
  member, isSelf, canKick, onKick,
}: {
  member: WtMemberDto;
  isSelf: boolean;
  canKick: boolean;
  onKick: () => void;
}) {
  const { t } = useTranslation("watchTogether");
  const status = memberStatus(member);
  const statusLabel = member.playbackError ? t("cantPlay")
    : member.buffering ? t("bufferingStatus")
    : member.inPlayback ? t("watching")
    : member.online ? t("online") : t("offline");

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <WtAvatar userId={member.userId} name={member.username} hasAvatar={member.hasAvatar} status={status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-content-primary">
            {member.username}{isSelf ? ` (${t("you")})` : ""}
          </span>
          {member.isHost && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: "rgba(139,92,246,0.2)", color: "#c4b5fd" }}
            >
              {t("host")}
            </span>
          )}
        </div>
        <span className="text-xs text-content-quaternary">{statusLabel}</span>
      </div>
      {canKick && !isSelf && (
        <button
          onClick={onKick}
          title={t("kick")}
          className="rounded-lg px-2 py-1 text-xs text-status-error-fg transition-colors hover:bg-danger-surface hover:text-status-error-fg"
        >
          {t("kick")}
        </button>
      )}
    </div>
  );
}

export function InviteRow({
  invite, onRespond, busy,
}: {
  invite: WtInviteDto;
  onRespond: (accept: boolean) => void;
  busy: boolean;
}) {
  const { t } = useTranslation("watchTogether");
  return (
    <div className="px-4 py-3">
      <p className="text-sm text-content-secondary">
        {invite.itemName
          ? t("invitedByWithItem", { name: invite.fromUsername, title: invite.itemName })
          : t("invitedBy", { name: invite.fromUsername })}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onRespond(true)}
          disabled={busy}
          className="rounded-lg bg-cta-primary-bg px-3 py-1.5 text-xs font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover disabled:opacity-40"
        >
          {t("accept")}
        </button>
        <button
          onClick={() => onRespond(false)}
          disabled={busy}
          className="rounded-lg bg-fill-soft px-3 py-1.5 text-xs font-semibold text-content-secondary transition-colors hover:bg-fill-medium disabled:opacity-40"
        >
          {t("decline")}
        </button>
      </div>
    </div>
  );
}
