import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useWatchTogether } from "./WatchTogetherProvider";

/**
 * Pilule flottante « Lecture de groupe en cours — Rejoindre » : visible pour un
 * membre hors de la page player pendant qu'une lecture de groupe est RÉELLEMENT
 * en cours — au moins un membre regarde (ou est attendu par le group-wait :
 * lecture en train de démarrer). Si plus personne ne regarde, pas de pilule ;
 * dès que quelqu'un relance une lecture, elle apparaît en temps réel (presence
 * diffusée). Clic → resynchronisation.
 *
 * Couleurs volontairement en dur : barre flottante au même verre sombre que
 * l'overlay de chat en lecture (rgba(15,15,25,…) + liseré marque) — reste
 * identique quel que soit le thème de la page qu'elle survole.
 */
export function GroupPlaybackPill() {
  const { room } = useWatchTogether();
  const { t } = useTranslation("watchTogether");
  const navigate = useNavigate();
  const location = useLocation();

  const itemId = room?.itemId ?? null;
  const playbackLive = !!room && (
    room.members.some((m) => m.inPlayback) || room.waitingForUserIds.length > 0
  );
  const visible = !!itemId && playbackLive && location.pathname !== `/watch/${itemId}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2"
        >
          <div
            className="flex items-center gap-3 rounded-full py-2 pl-4 pr-2"
            style={{
              background: "rgba(15,15,25,0.92)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(139,92,246,0.35)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(139,92,246,0.15)",
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-400" />
            </span>
            <span className="text-sm text-white/85">{t("groupPlaybackActive")}</span>
            <button
              onClick={() => navigate(`/watch/${itemId}`)}
              className="rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-black transition-colors duration-150 hover:bg-white/85"
            >
              {t("rejoin")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
