import { useEffect, useRef, useState } from "react";
import { useWatchTogether } from "./WatchTogetherProvider";
import { WatchTogetherPanel } from "./WatchTogetherPanel";
import { InviteUsersModal } from "./InviteUsersModal";

interface WatchTogetherButtonProps {
  dropdownPosition?: "below" | "right";
}

/** Icône header Watch Together : badge des invitations reçues, point violet si
 *  groupe actif, dropdown panneau (pattern NotificationBell). */
export function WatchTogetherButton({ dropdownPosition = "below" }: WatchTogetherButtonProps) {
  const { invites, isInGroup } = useWatchTogether();
  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside (la modale d'invitation vit hors du dropdown).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-content-quaternary transition-all duration-200 hover:bg-fill-soft hover:text-content-secondary"
        style={{ background: "rgba(255,255,255,0.05)" }}
        aria-label="Watch Together"
      >
        <GroupIcon active={isInGroup} />
        {invites.length > 0 ? (
          <div
            className="animate-pulse-glow absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
            style={{ background: "var(--brand)", boxShadow: "0 0 6px rgba(var(--brand-rgb), 0.6)" }}
          />
        ) : isInGroup ? (
          <div
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
            style={{ background: "#34d399", boxShadow: "0 0 6px rgba(52,211,153,0.6)" }}
          />
        ) : null}
      </button>

      {open && (
        <div
          className={`absolute z-50 animate-scale-in overflow-hidden rounded-xl ${
            dropdownPosition === "right"
              ? "bottom-0 left-full ml-2 w-96 origin-bottom-left"
              : "right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-96 origin-top-right"
          }`}
          style={{
            background: "rgba(15,15,25,0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          }}
        >
          <WatchTogetherPanel
            onOpenInvite={() => { setInviteOpen(true); setOpen(false); }}
            onClose={() => setOpen(false)}
          />
        </div>
      )}

      {inviteOpen && <InviteUsersModal onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

function GroupIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${active ? "text-purple-300" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}
