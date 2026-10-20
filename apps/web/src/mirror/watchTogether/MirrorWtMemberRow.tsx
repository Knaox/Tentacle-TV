import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Hourglass, LoaderCircle, UserMinus } from "lucide-react";
import type { WtMemberRowModel } from "@tentacle-tv/shared";
import { WtAvatar } from "../../watchTogether/WatchTogetherRows";

/**
 * Une ligne de la feuille du groupe — `WtMemberRow` du mobile, d'après le
 * modèle partagé (`roomMemberRows`) : avatar cerclé de son état, nom, « Vous »
 * / « Hôte », l'état EN MOTS (jamais la couleur seule) ; l'hôte expulse par le
 * bouton de bout de ligne (44 px).
 */
export const MirrorWtMemberRow = memo(function MirrorWtMemberRow({ row, onKick }: {
  row: WtMemberRowModel;
  onKick: (userId: string) => Promise<void>;
}) {
  const { t } = useTranslation("watchTogether");
  const [kicking, setKicking] = useState(false);
  const { member, isSelf, status, labelKey, canKick } = row;
  return (
    <div className="flex min-h-[56px] items-center gap-3 py-1.5">
      <WtAvatar userId={member.userId} name={member.username} hasAvatar={member.hasAvatar} size={40} status={status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold text-content-primary">{member.username}</span>
          {isSelf && <span className="rounded-full bg-fill-subtle px-1.5 text-[11px] font-semibold text-content-secondary">{t("you")}</span>}
          {member.isHost && <span className="rounded-full bg-[var(--brand-soft)] px-1.5 text-[11px] font-semibold text-[var(--brand-light)]">{t("host")}</span>}
        </div>
        <p className="truncate text-[13px] text-content-tertiary">{t(labelKey)}</p>
      </div>
      {canKick && (
        <button
          type="button"
          disabled={kicking}
          aria-label={`${t("kick")} — ${member.username}`}
          onClick={() => {
            setKicking(true);
            onKick(member.userId).catch(() => setKicking(false));
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-content-tertiary active:bg-fill-subtle"
        >
          {kicking ? <LoaderCircle size={18} className="animate-spin" aria-hidden /> : <UserMinus size={20} aria-hidden />}
        </button>
      )}
    </div>
  );
});

/** Une personne invitée qui n'a pas répondu : en retrait, un sablier immobile. */
export const MirrorWtPendingRow = memo(function MirrorWtPendingRow({ userId, username, hasAvatar }: {
  userId: string;
  username: string;
  hasAvatar: boolean;
}) {
  const { t } = useTranslation("watchTogether");
  return (
    <div className="flex min-h-[56px] items-center gap-3 py-1.5 opacity-70">
      <WtAvatar userId={userId} name={username} hasAvatar={hasAvatar} size={40} status="offline" />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-content-secondary">{username}</span>
        <span className="flex items-center gap-1 text-[13px] text-content-tertiary">
          <Hourglass size={12} aria-hidden />
          {t("invitePending")}
        </span>
      </div>
    </div>
  );
});
