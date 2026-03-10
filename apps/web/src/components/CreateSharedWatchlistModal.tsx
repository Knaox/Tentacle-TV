import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  useShareableUsers,
  useCreateSharedWatchlist,
  type ShareRole,
} from "@tentacle-tv/api-client";

interface Props {
  onClose: () => void;
}

interface SelectedUser {
  userId: string;
  username: string;
  role: ShareRole;
}

export function CreateSharedWatchlistModal({ onClose }: Props) {
  const { t } = useTranslation("common");
  const overlayRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const { data: users, isLoading: usersLoading } = useShareableUsers();
  const createList = useCreateSharedWatchlist();

  const [name, setName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Map<string, SelectedUser>>(new Map());

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => { if (e.target === overlayRef.current) onClose(); },
    [onClose]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [handleClickOutside, onClose]);

  const toggleUser = (userId: string, username: string) => {
    setSelectedUsers((prev) => {
      const m = new Map(prev);
      if (m.has(userId)) m.delete(userId);
      else m.set(userId, { userId, username, role: "reader" });
      return m;
    });
  };

  const changeRole = (userId: string, role: ShareRole) => {
    setSelectedUsers((prev) => {
      const m = new Map(prev);
      const entry = m.get(userId);
      if (entry) m.set(userId, { ...entry, role });
      return m;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const created = await createList.mutateAsync({ name: name.trim() });
    // Add members sequentially (small N, simpler than parallel)
    for (const member of selectedUsers.values()) {
      try {
        await addMemberFn(created.id, member);
      } catch { /* skip duplicate errors */ }
    }
    onClose();
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ animation: "modalFadeIn 200ms ease forwards" }}
    >
      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      <div
        className="mx-4 w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#12121a]/95 shadow-2xl backdrop-blur-lg sm:mx-0"
        style={{ animation: "modalSlideUp 250ms ease forwards" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{t("common:createSharedList")}</h2>
          <button onClick={onClose} className="text-white/40 transition-colors hover:text-white/80">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Name input */}
        <div className="border-b border-white/5 px-6 py-4">
          <label className="mb-1.5 block text-sm font-medium text-white/60">{t("common:listName")}</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("common:listNamePlaceholder")}
            className="w-full rounded-lg bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition-all focus:ring-purple-500/50"
          />
        </div>

        {/* User list */}
        <div className="max-h-[50vh] overflow-y-auto p-4">
          <p className="mb-3 text-sm text-white/40">{t("common:manageMembers")}</p>

          {usersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          ) : !users || users.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/30">{t("common:noResults")}</p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => {
                const sel = selectedUsers.get(user.Id);
                const isSelected = !!sel;
                return (
                  <div key={user.Id} className="rounded-lg bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold text-white">
                          {user.Name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-white">{user.Name}</span>
                      </div>

                      <button onClick={() => toggleUser(user.Id, user.Name)} className="shrink-0">
                        <div className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${isSelected ? "bg-purple-500" : "bg-white/10"}`}>
                          <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${isSelected ? "translate-x-5" : "translate-x-0.5"}`} />
                        </div>
                      </button>
                    </div>

                    {isSelected && (
                      <div className="mt-2 flex items-center gap-2 pl-12">
                        <RolePill
                          active={sel!.role === "reader"}
                          label={t("common:reader")}
                          onClick={() => changeRole(user.Id, "reader")}
                        />
                        <RolePill
                          active={sel!.role === "contributor"}
                          label={t("common:contributor")}
                          onClick={() => changeRole(user.Id, "contributor")}
                          accent
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 px-6 py-4">
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || createList.isPending}
            className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-purple-500/25 disabled:opacity-40"
          >
            {createList.isPending ? t("common:loading") : t("common:createList")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Helper: add a member using a fresh hook won't work outside React, so we use fetch directly */
async function addMemberFn(watchlistId: string, member: SelectedUser) {
  const token = localStorage.getItem("tentacle_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  await fetch(`/api/shared-watchlists/${watchlistId}/members`, {
    method: "POST",
    headers,
    credentials: token ? undefined : "include",
    body: JSON.stringify({ userId: member.userId, username: member.username, role: member.role }),
  });
}

function RolePill({ active, label, onClick, accent }: {
  active: boolean;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  const activeClass = accent
    ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
    : "bg-white/10 text-white/70 ring-1 ring-white/20";

  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
        active ? activeClass : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
      }`}
    >
      {label}
    </button>
  );
}
