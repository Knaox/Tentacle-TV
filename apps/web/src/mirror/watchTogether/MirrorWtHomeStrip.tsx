import { memo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HeartHandshake, Inbox, Users } from "lucide-react";
import { dismissAffinityPill, openAffinity, useAffinityStore } from "@tentacle-tv/api-client";
import { KIND_LABEL_KEY, elsewhereLabel, homeStripKind, memberName } from "@tentacle-tv/shared";
import { useWatchTogether } from "../../watchTogether/WatchTogetherProvider";
import { openRoomModal } from "../../watchTogether/roomModalStore";
import { openMirrorWtInbox } from "./mirrorWtInbox";

/**
 * La bande Watch Together de l'accueil du web étroit — `WtHomeStrip` du
 * mobile, d'après la règle partagée `homeStripKind` : UNE ligne (l'affinité à
 * rejoindre, la lecture de groupe, le groupe, les invitations, le groupe sur
 * un autre appareil). Le web étroit, comme le mobile, n'a pas d'entrée Watch
 * Together dans l'en-tête : c'est elle qui le garde sous la main.
 */
interface StripLine {
  Icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  text: string;
  action: string;
  press: () => void;
  /** Le toucher de la ligne elle-même, s'il diffère de son bouton (« Rejoindre » ≠ voir le groupe). */
  main?: () => void;
  dismiss?: () => void;
  dismissLabel?: string;
}

export const MirrorWtHomeStrip = memo(function MirrorWtHomeStrip() {
  const { t } = useTranslation("watchTogether");
  const navigate = useNavigate();
  const wt = useWatchTogether();
  const { state: affinity, pillDismissed } = useAffinityStore();
  const [elsewhereDismissed, setElsewhereDismissed] = useState(false);
  const { room, selfId } = wt;
  if (!wt.mayJoin) return null;

  const affinityInvite = !!affinity && !!room && pillDismissed !== affinity.sessionId
    && !affinity.participants.some((p) => p.userId === selfId);
  const kind = homeStripKind({
    inGroup: !!room, groupItemId: room?.itemId ?? null, affinityInvite,
    inviteCount: wt.invites.length, elsewhere: !!wt.elsewhere, elsewhereDismissed,
  });
  if (!kind) return null;

  const line: StripLine = kind === "elsewhere" && wt.elsewhere
    ? { Icon: Users, text: elsewhereText(wt.elsewhere, wt.selfId, t),
      action: t("elsewhereJoinHere"), press: () => void wt.actions.joinHere(),
      dismiss: () => setElsewhereDismissed(true), dismissLabel: t("elsewhereDismiss") }
    : kind === "affinity" && affinity
      ? { Icon: HeartHandshake, text: t("affinityPillInvite", { name: memberName(room, affinity.startedBy), kind: t(KIND_LABEL_KEY[affinity.kind]) }),
        action: t("affinityJoin"), press: () => openAffinity("deck"), dismiss: () => dismissAffinityPill(affinity.sessionId), dismissLabel: t("affinityDismiss") }
      : kind === "playing" && room?.itemId
        ? { Icon: Users, text: t("groupPlaybackActive"), action: t("rejoin"), press: () => navigate(`/watch/${room.itemId}`), main: () => openRoomModal("room") }
        : kind === "group"
          ? { Icon: Users, text: t("yourGroup"), action: t("openRoom"), press: () => openRoomModal("room") }
          : { Icon: Inbox, text: t("invitations"), action: String(wt.invites.length), press: openMirrorWtInbox };

  return (
    <div className="px-4 pb-2 pt-1">
      <div className="flex items-center gap-2 rounded-2xl border border-line-subtle bg-surface-1 py-2 pl-3 pr-2">
        <button type="button" onClick={line.main ?? line.press} className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 text-left">
          <line.Icon size={20} aria-hidden className="shrink-0 text-[var(--brand-light)]" />
          <span className="truncate text-[14px] font-semibold text-content-primary">{line.text}</span>
        </button>
        <button type="button" onClick={line.press} className="min-h-9 shrink-0 rounded-full border border-line-subtle bg-fill-soft px-3 text-[13px] font-semibold text-content-primary">
          {line.action}
        </button>
        {line.dismiss && (
          <button type="button" onClick={line.dismiss} className="min-h-9 shrink-0 px-1.5 text-[13px] font-semibold text-content-secondary">{line.dismissLabel}</button>
        )}
      </div>
    </div>
  );
});

/** « Votre groupe… » quand l'hôte est ce compte, sinon « Groupe de X… » (règle partagée). */
function elsewhereText(
  elsewhere: Parameters<typeof elsewhereLabel>[0], selfId: string | null, t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const said = elsewhereLabel(elsewhere, selfId);
  return "params" in said ? t(said.key, said.params) : t(said.key);
}
