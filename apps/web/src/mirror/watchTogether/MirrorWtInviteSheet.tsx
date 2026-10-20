import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, Search } from "lucide-react";
import { useInvitableUsers } from "@tentacle-tv/api-client";
import { inviteCandidates, toggleSelection, type WtInvitableUserDto } from "@tentacle-tv/shared";
import { useWatchTogether } from "../../watchTogether/WatchTogetherProvider";
import { WtAvatar } from "../../watchTogether/WatchTogetherRows";
import { showRoomView } from "../../watchTogether/roomModalStore";
import { PrimaryCta } from "../screens/misc/shared/PrimaryCta";

/**
 * « Inviter des membres » du web étroit — `WtInviteSheet` du mobile, d'après
 * les règles partagées (`inviteCandidates` : déjà dans le groupe = absent,
 * déjà invité = grisé, en ligne d'abord ; `toggleSelection`). L'envoi est
 * celui de la séance partagée ; « ‹ » revient à la feuille du groupe.
 */
export function MirrorWtInviteSheet() {
  const { t } = useTranslation("watchTogether");
  const { room, pendingInvites, actions } = useWatchTogether();
  const { data: users } = useInvitableUsers(true);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<ReadonlyMap<string, WtInvitableUserDto>>(new Map());
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useMemo(() => new Set(pendingInvites.map((p) => p.userId)), [pendingInvites]);
  const candidates = useMemo(
    () => (room ? inviteCandidates(users ?? [], room, pending, query) : []),
    [users, room, pending, query],
  );
  if (!room) return null;

  const send = () => {
    setSending(true);
    setFailed(false);
    actions.invite([...selection.values()]).then(
      () => { setSelection(new Map()); setSending(false); showRoomView("room"); },
      () => { setSending(false); setFailed(true); },
    );
  };

  return (
    <div className="flex flex-col px-5 pb-6">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => showRoomView("room")} aria-label={t("back")} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-content-primary active:bg-fill-subtle">
          <ArrowLeft size={20} aria-hidden />
        </button>
        <h2 className="text-[22px] font-extrabold text-content-primary">{t("inviteTitle")}</h2>
      </div>
      <p className="mt-1 text-[14px] leading-5 text-content-secondary">{t("inviteHint")}</p>
      <label className="mt-4 flex min-h-11 items-center gap-2 rounded-xl border border-line-subtle bg-fill-subtle px-3">
        <Search size={16} aria-hidden className="text-content-tertiary" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchUsers")}
          aria-label={t("searchUsers")}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-content-primary outline-none placeholder:text-content-quaternary"
        />
      </label>
      <ul className="mt-3 flex flex-col">
        {candidates.length === 0 && <li className="py-6 text-center text-[14px] text-content-tertiary">{t("noUsersFound")}</li>}
        {candidates.map((candidate) => {
          const { user, invited } = candidate;
          const selected = selection.has(user.id);
          return (
            <li key={user.id}>
              <button
                type="button"
                disabled={invited}
                aria-pressed={selected}
                onClick={() => setSelection((current) => toggleSelection(current, candidate))}
                className="flex min-h-[56px] w-full items-center gap-3 py-1.5 text-left disabled:opacity-60"
              >
                <WtAvatar userId={user.id} name={user.name} hasAvatar={user.hasAvatar} size={36} status={user.isOnline ? "watching" : "offline"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-content-primary">{user.name}</span>
                  <span className="block text-[13px] text-content-tertiary">{invited ? t("alreadyInvited") : user.isOnline ? t("online") : t("offline")}</span>
                </span>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-[var(--brand)] bg-[var(--brand)] text-cta-brand-fg" : "border-line-strong"}`}>
                  {selected && <Check size={14} aria-hidden />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {failed && <p role="status" className="mt-2 text-center text-[13px] text-[var(--status-error)]">{t("errorGeneric")}</p>}
      <div className="sticky bottom-0 mt-4 bg-[color:var(--surface-sheet)] pt-2">
        <PrimaryCta onPress={send} disabled={selection.size === 0} loading={sending}>
          {selection.size > 0 ? t("sendInvitesCount", { count: selection.size }) : t("sendInvites")}
        </PrimaryCta>
      </div>
    </div>
  );
}
