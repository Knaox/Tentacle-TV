import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tentacle-tv/api-client";

function checkIsAdmin(): boolean {
  try {
    const raw = localStorage.getItem("tentacle_user");
    if (!raw) return false;
    return JSON.parse(raw).Policy?.IsAdministrator === true;
  } catch {
    return false;
  }
}

function getUserInitial(): string {
  try {
    const raw = localStorage.getItem("tentacle_user");
    if (!raw) return "?";
    const user = JSON.parse(raw);
    return (user.Name ?? "?").charAt(0).toUpperCase();
  } catch {
    return "?";
  }
}

export function UserAvatarMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation("nav");
  const { logout } = useAuth();
  const isAdmin = checkIsAdmin();
  const initial = getUserInitial();

  const handleLogout = useCallback(() => {
    setOpen(false);
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  }, [logout, navigate]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const menuItems = [
    { key: "settings", label: t("preferences"), icon: <SettingsIcon />, action: () => navigate("/settings") },
    ...(isAdmin
      ? [{ key: "admin", label: t("admin"), icon: <AdminIcon />, action: () => navigate("/admin") }]
      : []),
    { key: "pair", label: t("pairDevice"), icon: <PairIcon />, action: () => navigate("/pair-device") },
    { key: "about", label: t("about"), icon: <InfoIcon />, action: () => navigate("/about") },
    { key: "help", label: t("help"), icon: <HelpIcon />, action: () => navigate("/support") },
    { key: "divider", label: "", icon: null, action: () => {} },
    { key: "logout", label: t("logout"), icon: <LogoutIcon />, action: handleLogout },
  ];

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white transition-transform duration-200 hover:-translate-y-0.5"
        style={{
          background: "linear-gradient(135deg, #6D28D9, #8B5CF6)",
          border: "2px solid rgba(139,92,246,0.3)",
        }}
      >
        {initial}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 animate-scale-in origin-top-right overflow-hidden rounded-xl py-1.5"
          style={{
            background: "rgba(15,15,25,0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          }}
        >
          {menuItems.map((item) => {
            if (item.key === "divider") {
              return <div key="divider" className="my-1.5 border-t border-white/5" />;
            }
            return (
              <button
                key={item.key}
                onClick={() => {
                  setOpen(false);
                  item.action();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-white/5 ${
                  item.key === "logout" ? "text-red-400" : "text-white/70 hover:text-white/90"
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Icons (18×18) ── */
function SettingsIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function PairIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.5 8.25" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}
