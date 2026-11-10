import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { duration, easeOut } from "../theme/motion";
import { WT_NOTICE } from "./wtSkin";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { elsewhereLabel } from "@tentacle-tv/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../contexts/ToastContext";
import { useWatchTogether } from "./WatchTogetherProvider";

/**
 * « Groupe en cours sur un autre appareil — Rejoindre ici » (1.31.1,
 * adhésion par appareil). Ce compte regarde en groupe AILLEURS ; cet appareil
 * n'en reçoit rien — ni lancement, ni état — et le dit discrètement, une
 * pilule en bas d'écran, masquable pour ce groupe — jamais sur un lecteur,
 * où elle couvrirait la barre de lecture. « Rejoindre ici » AJOUTE cet
 * appareil à la salle (les autres y restent).
 *
 * Même avis que la pilule « Lecture de groupe en cours » (`GroupPlaybackPill`),
 * qu'elle ne croise jamais : l'une est pour un appareil DANS la salle, l'autre
 * pour un appareil hors d'elle.
 */
export function ElsewhereNotice() {
  const { elsewhere, actions, selfId } = useWatchTogether();
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const [dismissedGroup, setDismissedGroup] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const onPlayer = useLocation().pathname.startsWith("/watch/");

  const visible = !!elsewhere && dismissedGroup !== elsewhere.groupId && !onPlayer;
  // « Votre groupe… » quand l'hôte est ce compte, sinon « Groupe de X… » (règle partagée).
  const said = elsewhere ? elsewhereLabel(elsewhere, selfId) : null;
  const label = !said ? "" : "params" in said ? t(said.key, said.params) : t(said.key);

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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: easeOut } }}
          exit={{ opacity: 0, y: 16, transition: { duration: duration.menuOut, ease: easeOut } }}
          className="fixed bottom-5 left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2"
          role="status"
        >
          {/* Un avis du socle (`.ui-toast`), en pilule : il suit le thème de la page qu'il survole. */}
          <div className={WT_NOTICE}>
            <UsersThreeIcon size={18} weight="fill" className="shrink-0 text-accent" aria-hidden />
            <span className="truncate">{label}</span>
            <button type="button" onClick={joinHere} disabled={joining} className="btn btn-sm btn-solid">
              {t("elsewhereJoinHere")}
            </button>
            <button
              type="button"
              onClick={() => setDismissedGroup(elsewhere!.groupId)}
              aria-label={t("elsewhereDismiss")}
              title={t("elsewhereDismiss")}
              className="icon-btn btn-sm"
            >
              <XIcon size={14} weight="bold" aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
