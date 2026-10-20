import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../contexts/ToastContext";
import { useWatchTogether } from "./WatchTogetherProvider";

/**
 * « Groupe en cours sur un autre appareil — Rejoindre ici » (1.32.0,
 * adhésion par appareil). Ce compte regarde en groupe AILLEURS ; cet appareil
 * n'en reçoit rien — ni lancement, ni état — et le dit discrètement, une
 * pilule en bas d'écran, masquable pour ce groupe — jamais sur un lecteur,
 * où elle couvrirait la barre de lecture. « Rejoindre ici » AJOUTE cet
 * appareil à la salle (les autres y restent).
 *
 * Même verre que la pilule « Lecture de groupe en cours » (`GroupPlaybackPill`),
 * qu'elle ne croise jamais : l'une est pour un appareil DANS la salle, l'autre
 * pour un appareil hors d'elle.
 */
export function ElsewhereNotice() {
  const { elsewhere, actions } = useWatchTogether();
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const [dismissedGroup, setDismissedGroup] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const onPlayer = useLocation().pathname.startsWith("/watch/");

  const visible = !!elsewhere && dismissedGroup !== elsewhere.groupId && !onPlayer;
  const label = elsewhere?.hostUsername
    ? t("elsewhereActiveWithHost", { name: elsewhere.hostUsername })
    : t("elsewhereActive");

  const joinHere = () => {
    setJoining(true);
    actions.joinHere()
      .catch(() => show("error", t("elsewhereJoinFailed")))
      .finally(() => setJoining(false));
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-5 left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2"
          role="status"
        >
          <div
            className="flex items-center gap-3 rounded-full py-2 pl-4 pr-2"
            style={{
              background: "rgba(15,15,25,0.92)",
              border: "1px solid rgba(139,92,246,0.25)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-purple-400/70" aria-hidden />
            <span className="truncate text-sm text-white/80">{label}</span>
            <button
              onClick={joinHere}
              disabled={joining}
              className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-black transition-colors duration-150 hover:bg-white/85 disabled:opacity-60"
            >
              {t("elsewhereJoinHere")}
            </button>
            <button
              onClick={() => setDismissedGroup(elsewhere!.groupId)}
              aria-label={t("elsewhereDismiss")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors duration-150 hover:bg-white/10 hover:text-white/80"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
