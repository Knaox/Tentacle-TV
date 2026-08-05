import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { useUserId } from "@tentacle-tv/api-client";
import { Modal } from "../ui/Modal";
import { LeaderboardRow } from "./LeaderboardRow";
import { valeurDeRang } from "./leaderboardFormat";
import { useClassement } from "./leaderboardApi";

/** Cascade de 40 ms — la même que `textCascade`, dans la fourchette qui laisse
 *  percevoir l'ordre sans donner l'impression d'attendre la dernière ligne. */
const LISTE = { show: { transition: { delayChildren: 0.06, staggerChildren: 0.04 } } };

/**
 * Le classement de visionnage, ouvert par quatre clics sur le logo.
 *
 * Bâti sur `Modal`, la primitive du projet : échappement, verrou de défilement,
 * piège à focus et scrim en viennent gratuitement.
 */
export function WatchLeaderboardPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("easterEggs");
  const monId = useUserId();
  const sansMouvement = !!useReducedMotion();

  const { data, isLoading, isError } = useClassement();

  // Le premier donne l'échelle des barres. Recalculé ici plutôt que côté
  // serveur : c'est une affaire d'affichage, pas de données.
  const maximum = useMemo(
    () => (data?.entries ?? []).reduce((m, e) => Math.max(m, valeurDeRang(e)), 0),
    [data],
  );

  return (
    <Modal open onClose={onClose} maxWidth={620} labelledBy="classement-titre">
      <div className="max-h-[78vh] overflow-y-auto p-5 scrollbar-thin">
        <header className="mb-4">
          <h2 id="classement-titre" className="text-lg font-bold text-content-primary">
            {t("titre")}
          </h2>
          <p className="mt-0.5 text-xs text-content-tertiary">{t("sousTitre")}</p>
        </header>

        {isLoading && (
          <ul className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="skeleton-shimmer h-16 rounded-xl" />
            ))}
          </ul>
        )}

        {isError && <p className="py-10 text-center text-sm text-content-tertiary">{t("erreur")}</p>}

        {data && data.entries.length === 0 && (
          <p className="py-10 text-center text-sm text-content-tertiary">{t("vide")}</p>
        )}

        {data && data.entries.length > 0 && (
          <motion.ul
            variants={sansMouvement ? undefined : LISTE}
            initial={sansMouvement ? false : "hidden"}
            animate="show"
            className="space-y-1"
          >
            {data.entries.map((e, i) => (
              <LeaderboardRow
                key={e.userId}
                entree={e}
                rang={i + 1}
                maximum={maximum}
                moi={e.userId === monId}
                sansMouvement={sansMouvement}
              />
            ))}
          </motion.ul>
        )}

        {/* Dire d'où sortent les chiffres — surtout quand ils sont reconstitués :
            une durée affichée sans réserve passerait pour une mesure. */}
        {data && (
          <p className="mt-4 border-t border-line-subtle pt-3 text-[11px] leading-relaxed text-content-quaternary">
            {data.estimated ? t("noteEstimation") : t("noteMesure")}
          </p>
        )}
      </div>
    </Modal>
  );
}
