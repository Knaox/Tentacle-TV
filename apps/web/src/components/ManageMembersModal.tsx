import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  useShareableUsers,
  useSharedWatchlistMembers,
  useAddSharedWatchlistMember,
  useUpdateMemberRole,
  useRemoveMember,
  type SharedWatchlistMember,
  type ShareRole,
} from "@tentacle-tv/api-client";

interface Props {
  watchlistId: string;
  watchlistName: string;
  onClose: () => void;
}

export function ManageMembersModal({ watchlistId, watchlistName, onClose }: Props) {
  const { t } = useTranslation("common");
  const overlayRef = useRef<HTMLDivElement>(null);
  const { data: users, isLoading: usersLoading } = useShareableUsers();
  const { data: members } = useSharedWatchlistMembers(watchlistId);
  const addMember = useAddSharedWatchlistMember(watchlistId);
  const updateRole = useUpdateMemberRole(watchlistId);
  const removeMember = useRemoveMember(watchlistId);

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

  const memberIds = new Set(members?.map((m) => m.userId) ?? []);

  const handleInvite = (userId: string, username: string) => {
    addMember.mutate({ userId, username, role: "reader" });
  };

  const handleRoleChange = (memberId: string, role: ShareRole) => {
    updateRole.mutate({ memberId, role });
  };

  const handleRemove = (memberId: string) => {
    removeMember.mutate(memberId);
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
          <div>
            <h2 className="text-lg font-semibold text-white">{t("common:manageMembers")}</h2>
            <p className="text-xs text-white/40">{watchlistName}</p>
          </div>
          <button onClick={onClose} className="text-white/40 transition-colors hover:text-white/80">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {/* Current members */}
          {members && members.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">
                {t("common:memberCount", { count: members.length })}
              </p>
              <div className="space-y-2">
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    onRoleChange={handleRoleChange}
                    onRemove={handleRemove}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Invite new */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">
              {t("common:addMedia").replace("média", "membre")}
            </p>
            {usersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {users?.filter((u) => !memberIds.has(u.Id)).map((user) => (
                  <div key={user.Id} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-4 py-2.5 transition-colors hover:bg-white/[0.04]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white">
                        {user.Name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-white/70">{user.Name}</span>
                    </div>
                    <button
                      onClick={() => handleInvite(user.Id, user.Name)}
                      disabled={addMember.isPending}
                      className="rounded-lg bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-300 ring-1 ring-purple-500/20 transition-all hover:bg-purple-500/20 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function MemberRow({
  member,
  onRoleChange,
  onRemove,
  t,
}: {
  member: SharedWatchlistMember;
  onRoleChange: (memberId: string, role: ShareRole) => void;
  onRemove: (memberId: string) => void;
  t: (key: string) => string;
}) {
  const isContributor = member.role === "contributor";

  return (
    <div className="flex items-center justify-between rounded-lg bg-white/[0.02] px-4 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white">
          {member.username.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm text-white/70">{member.username}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <RolePill
            active={!isContributor}
            label={t("common:reader")}
            onClick={() => onRoleChange(member.id, "reader")}
          />
          <RolePill
            active={isContributor}
            label={t("common:contributor")}
            onClick={() => onRoleChange(member.id, "contributor")}
            accent
          />
        </div>
        <button
          onClick={() => onRemove(member.id)}
          className="rounded p-1 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function RolePill({ active, label, onClick, accent }: {
  active: boolean; label: string; onClick: () => void; accent?: boolean;
}) {
  const activeClass = accent
    ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
    : "bg-white/10 text-white/70 ring-1 ring-white/20";
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all ${
        active ? activeClass : "bg-white/5 text-white/40 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}
