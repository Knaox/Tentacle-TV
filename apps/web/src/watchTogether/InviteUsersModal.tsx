import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useInvitableUsers } from "@tentacle-tv/api-client";
import { correspondALaRecherche } from "@tentacle-tv/shared";
import { useToast } from "../contexts/ToastContext";
import { useWatchTogether } from "./WatchTogetherProvider";
import { WtAvatar } from "./WatchTogetherRows";

interface InviteUsersModalProps {
  onClose: () => void;
}

/** Modale d'invitation : utilisateurs du serveur (présence en ligne), filtre
 *  texte, multi-sélection, envoi groupé. Gabarit overlay ShareLinkModal. */
export function InviteUsersModal({ onClose }: InviteUsersModalProps) {
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const { room, actions } = useWatchTogether();
  const { data: users, isLoading } = useInvitableUsers(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const memberIds = useMemo(
    () => new Set((room?.members ?? []).map((m) => m.userId)),
    [room],
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    return (users ?? [])
      .filter((u) => !memberIds.has(u.id))
      .filter((u) => correspondALaRecherche(u.name, q));
  }, [users, memberIds, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      const count = await actions.invite([...selected]);
      show("success", t("invitesSent", { count }));
      onClose();
    } catch {
      show("error", t("errorGeneric"));
      setSending(false);
    }
  };

  // Portal vers <body> : rendue depuis le header (TopNav), la modale serait
  // sinon piégée par son backdrop-filter (containing block des position:fixed)
  // et s'afficherait coupée dans la barre.
  return createPortal(
    <div
      // Voile de modale : reste sombre dans les deux thèmes (standard iOS).
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Le puits d'input (bg-black/40) reste en dur : c'est un creux, pas une
          surface de chrome. Le fond de carte, lui, est passé sur --surface-modal. */}
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-line-strong bg-surface-modal shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6 pb-4">
          <h2 className="text-lg font-bold text-content-primary">{t("selectUsers")}</h2>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchUsers")}
            autoFocus
            className="mt-4 w-full rounded-lg border border-line-subtle bg-black/40 px-3 py-2.5 text-sm text-content-primary placeholder-content-quaternary outline-none transition-colors focus:border-purple-400/50"
          />
        </div>

        <div className="min-h-24 flex-1 overflow-y-auto px-3 pb-2">
          {isLoading ? (
            <div className="space-y-2 px-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded-lg bg-fill-subtle" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-content-quaternary">{t("noUsersFound")}</p>
          ) : (
            filtered.map((u) => {
              const isSelected = selected.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    isSelected ? "bg-purple-500/15" : "hover:bg-fill-subtle"
                  }`}
                >
                  <WtAvatar userId={u.id} name={u.name} hasAvatar={u.hasAvatar} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm text-content-primary">{u.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-content-quaternary">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: u.isOnline ? "#34d399" : "rgba(255,255,255,0.2)" }}
                    />
                    {u.isOnline ? t("online") : t("offline")}
                  </span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                      isSelected
                        ? "border-purple-400 bg-purple-500 text-cta-brand-fg"
                        : "border-line-strong text-transparent"
                    }`}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-2 border-t border-line-subtle p-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-fill-soft py-2.5 text-sm font-semibold text-content-secondary transition-colors hover:bg-fill-medium"
          >
            {t("cancel")}
          </button>
          <button
            onClick={send}
            disabled={selected.size === 0 || sending}
            className="flex-1 rounded-lg bg-cta-primary-bg py-2.5 text-sm font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover disabled:opacity-40"
          >
            {selected.size > 0 ? t("sendInvitesCount", { count: selected.size }) : t("sendInvites")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
