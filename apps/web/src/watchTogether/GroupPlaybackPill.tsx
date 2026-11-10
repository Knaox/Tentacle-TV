import { duration, easeOut } from "../theme/motion";
import { WT_NOTICE } from "./wtSkin";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useWatchTogether } from "./WatchTogetherProvider";

/**
 * Pilule flottante « Lecture de groupe en cours — Rejoindre » : visible pour un
 * membre hors de la page player pendant qu'une lecture de groupe est RÉELLEMENT
 * en cours — au moins un membre regarde (ou est attendu par le group-wait :
 * lecture en train de démarrer). Si plus personne ne regarde, pas de pilule ;
 * dès que quelqu'un relance une lecture, elle apparaît en temps réel (presence
 * diffusée). Clic → `joinPlayback` : la salle se gèle au clic et attend cet
 * appareil, puis le lecteur s'ouvre à la position de la pause.
 *
 * Un avis du socle (refonte de nov. 2026) : il suit le thème de la page qu'il survole,
 * comme les autres avis de l'application.
 */
export function GroupPlaybackPill() {
  const { room, actions } = useWatchTogether();
  const { t } = useTranslation("watchTogether");
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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: easeOut } }}
          exit={{ opacity: 0, y: 16, transition: { duration: duration.menuOut, ease: easeOut } }}
          className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2"
        >
          {/* Un avis du socle, en pilule : opaque (plus de flou ni de lueur de marque), et son
              témoin est immobile — une onde qui bat sans fin ne dit rien de plus qu'un point. */}
          <div className={WT_NOTICE} role="status">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
            <span className="truncate">{t("groupPlaybackActive")}</span>
            {/* Rejoindre la LECTURE : l'action de lecture de l'avis. */}
            <button type="button" onClick={() => { void actions.joinPlayback(); }} className="btn btn-sm btn-play">
              {t("rejoin")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
