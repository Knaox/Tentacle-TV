import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, LoaderCircle, Send, X } from "lucide-react";
import type { WtInvitableUserDto, WtRoomStateDto } from "@tentacle-tv/shared";
import { useInvitableUsers } from "@tentacle-tv/api-client";
import { matchesSearch } from "@tentacle-tv/shared";
import { useToast } from "../../contexts/ToastContext";
import { ScopedSearchField } from "../../components/search/ScopedSearchField";
import { useWatchTogether } from "../WatchTogetherProvider";
import { WtAvatar } from "../WatchTogetherRows";
import { showRoomView } from "../roomModalStore";

/**
 * Inviter une ou plusieurs personnes dans la salle.
 *
 * - En ligne d'abord : ce sont elles qui peuvent rejoindre maintenant.
 * - La sélection s'affiche en pastilles au-dessus de la liste — on voit qui
 *   part avant d'envoyer, et l'on en retire d'un clic.
 * - Déjà dans la salle : absent de la liste. Déjà invité : visible, grisé.
 * - Une fois envoyées, retour à la salle, où les invitations attendent leur
 *   réponse sous les yeux.
 */

const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-5 text-sm font-bold text-cta-primary-fg outline-none transition-[background-color,transform] duration-150 hover:bg-cta-primary-bg-hover active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

function UserRow({ user, selected, invited, onToggle }: {
  user: WtInvitableUserDto;
  selected: boolean;
  invited: boolean;
  onToggle: (user: WtInvitableUserDto) => void;
}) {
  const { t } = useTranslation("watchTogether");
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        disabled={invited}
        onClick={() => onToggle(user)}
        className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-default ${
          selected ? "bg-[rgba(var(--brand-rgb),0.14)]" : "hover:bg-fill-subtle"
        }`}
      >
        <span className={invited ? "opacity-50" : undefined}>
          <WtAvatar userId={user.id} name={user.name} hasAvatar={user.hasAvatar} size={36} status={user.isOnline ? "watching" : "offline"} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-medium ${invited ? "text-content-tertiary" : "text-content-primary"}`}>{user.name}</span>
          <span className="block text-xs text-content-tertiary">
            {invited ? t("alreadyInvited") : user.isOnline ? t("online") : t("offline")}
          </span>
        </span>
        {!invited && (
          <span
            aria-hidden
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
              selected ? "border-transparent bg-[var(--brand)] text-white" : "border-line-strong text-transparent"
            }`}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </button>
    </li>
  );
}

export function InviteView({ room, titleId }: { room: WtRoomStateDto; titleId: string }) {
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const { pendingInvites, actions } = useWatchTogether();
  const { data: users, isLoading } = useInvitableUsers(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlyMap<string, WtInvitableUserDto>>(new Map());
  const [sending, setSending] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const invitedIds = useMemo(() => new Set(pendingInvites.map((p) => p.userId)), [pendingInvites]);
  const candidates = useMemo(() => {
    const members = new Set(room.members.map((m) => m.userId));
    return (users ?? [])
      .filter((u) => !members.has(u.id) && matchesSearch(u.name, query.trim()))
      .sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || a.name.localeCompare(b.name));
  }, [users, room.members, query]);
  const online = candidates.filter((u) => u.isOnline);
  const offline = candidates.filter((u) => !u.isOnline);

  const toggle = (user: WtInvitableUserDto) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(user.id)) next.delete(user.id);
      else next.set(user.id, user);
      return next;
    });
  };

  const send = async () => {
    if (selected.size === 0 || sending) return;
    setSending(true);
    try {
      const count = await actions.invite([...selected.values()]);
      show("success", t("invitesSent", { count }));
      showRoomView("room");
    } catch {
      show("error", t("errorGeneric"));
      setSending(false);
    }
  };

  const section = (label: string, list: WtInvitableUserDto[]) => list.length > 0 && (
    <section>
      <h3 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">{label}</h3>
      <ul>
        {list.map((user) => (
          <UserRow key={user.id} user={user} selected={selected.has(user.id)} invited={invitedIds.has(user.id)} onToggle={toggle} />
        ))}
      </ul>
    </section>
  );

  return (
    <>
      <header className="flex items-start gap-2 px-4 pb-3 pt-5">
        <button
          type="button"
          onClick={() => showRoomView("room")}
          aria-label={t("back")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
        >
          <ArrowLeft aria-hidden className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 pt-1">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-content-primary">{t("inviteTitle")}</h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-content-tertiary">{t("inviteHint")}</p>
        </div>
      </header>

      <div className="space-y-3 px-6 pb-3">
        <ScopedSearchField ref={searchRef} value={query} onChange={setQuery} placeholder={t("searchUsers")} />
        {selected.size > 0 && (
          <ul aria-label={t("selectedCount", { count: selected.size })} className="flex flex-wrap gap-1.5">
            {[...selected.values()].map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => toggle(user)}
                  aria-label={t("removeSelection", { name: user.name })}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[rgba(var(--brand-rgb),0.18)] pl-1 pr-2.5 text-[13px] font-medium text-content-primary transition-colors hover:bg-[rgba(var(--brand-rgb),0.28)]"
                >
                  <WtAvatar userId={user.id} name={user.name} hasAvatar={user.hasAvatar} size={24} />
                  {user.name}
                  <X aria-hidden className="h-3.5 w-3.5 text-content-tertiary" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-h-32 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
        {isLoading ? (
          <div className="space-y-2 px-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-fill-subtle" />)}
          </div>
        ) : candidates.length === 0 ? (
          <p className="py-8 text-center text-sm text-content-tertiary">{t("noUsersFound")}</p>
        ) : (
          <>
            {section(t("online"), online)}
            {section(t("offline"), offline)}
          </>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-line-subtle px-6 py-4">
        <span className="text-[13px] tabular-nums text-content-tertiary">
          {selected.size > 0 ? t("selectedCount", { count: selected.size }) : ""}
        </span>
        <button type="button" className={PRIMARY} disabled={selected.size === 0} aria-busy={sending || undefined} onClick={() => void send()}>
          {sending ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> : <Send aria-hidden className="h-4 w-4" />}
          {selected.size > 0 ? t("sendInvitesCount", { count: selected.size }) : t("sendInvites")}
        </button>
      </footer>
    </>
  );
}
