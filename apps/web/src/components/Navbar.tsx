import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@tentacle/api-client";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

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
      <h1
        onClick={() => navigate("/")}
        className="cursor-pointer text-2xl font-bold tracking-tight"
      >
        <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Tentacle
        </span>
      </h1>

      <button
        onClick={handleLogout}
        className="rounded-lg bg-white/10 px-4 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/20 hover:text-white"
      >
        Déconnexion
      </button>
    </nav>
  );
}
