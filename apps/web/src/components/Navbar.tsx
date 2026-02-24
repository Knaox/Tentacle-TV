import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@tentacle/api-client";
import { NotificationBell } from "./NotificationBell";

function isAdmin(): boolean {
  try {
    const raw = localStorage.getItem("tentacle_user");
    if (!raw) return false;
    const user = JSON.parse(raw);
    return user.Policy?.IsAdministrator === true;
  } catch { return false; }
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const admin = useMemo(isAdmin, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  };

  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-12 py-4 transition-colors duration-300 ${
        scrolled ? "bg-tentacle-bg/95 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div
        onClick={() => navigate("/")}
        className="flex cursor-pointer items-center gap-3"
      >
        <img src="/tentacle-logo-pirate.svg" alt="Tentacle" className="h-9 w-9" />
        <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Tentacle
        </span>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <button
          onClick={() => navigate("/preferences")}
          className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          title="Préférences langues"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
        </button>
        {admin && (
          <button
            onClick={() => navigate("/admin")}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title="Administration"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
        <button
          onClick={handleLogout}
          className="rounded-lg bg-white/10 px-4 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          Déconnexion
        </button>
      </div>
    </nav>
  );
}
