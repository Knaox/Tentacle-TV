import { memo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useQualityDropNotice } from "@tentacle-tv/api-client";
import { QUALITY_DROP_NOTICE_MS, type QualityDrop } from "@tentacle-tv/shared";
import { NoticeCard } from "../notices/NoticeCard";
import { useMessageCountdown } from "../session/useMessageCountdown";

interface Props {
  drop: QualityDrop | null;
  /** La première image est affichée. */
  started: boolean;
  itemId: string | undefined;
}

/**
 * « Qualité réduite » sur le lecteur web et le bureau — la règle partagée
 * (`useQualityDropNotice`) rendue dans la carte des avertissements, habillée
 * pour la vidéo. Sous la barre du haut (jamais sur Retour), au centre ; 6 s
 * suspendues au survol et au focus ; « Ne plus afficher » est un rappel du
 * COMPTE. Monté seulement quand il y a quelque chose à dire (règle GPU).
 */
export const QualityDropNotice = memo(function QualityDropNotice({ drop, started, itemId }: Props) {
  const { t, i18n } = useTranslation(["player", "notices"]);
  const notice = useQualityDropNotice({ drop, started, itemId, locale: i18n.language });
  const view = notice.view;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-20 z-40 flex justify-center px-4"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <AnimatePresence initial={false}>
        {view?.kind === "drop" && (
          <Timed key={view.key} onDone={notice.close}>
            {(countdown) => (
              <NoticeCard
                surface="player" severity="info" icon="gauge"
                title={t("player:qualityDropTitle")}
                lines={[t(view.text.key, view.text.values)]}
                secondary={view.canDismiss ? { label: t("notices:dismissForGood"), onClick: notice.dismissForGood } : undefined}
                countdown={countdown} durationMs={QUALITY_DROP_NOTICE_MS} onClose={notice.close}
              />
            )}
          </Timed>
        )}
        {view?.kind === "dismissed" && (
          <Timed key="dismissed" onDone={notice.close}>
            {(countdown) => (
              <NoticeCard
                surface="player" severity="info" icon="check"
                lines={[t("player:qualityDropDismissed")]}
                primary={{ label: t("notices:undo"), onClick: notice.undo }}
                countdown={countdown} durationMs={QUALITY_DROP_NOTICE_MS} onClose={notice.close}
              />
            )}
          </Timed>
        )}
      </AnimatePresence>
    </div>
  );
});

/** Le temps d'une carte, suspendu au survol et au focus — la même mécanique que `NoticeHost`. */
function Timed({ onDone, children }: {
  onDone: () => void;
  children: (countdown: ReturnType<typeof useMessageCountdown>) => React.ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const countdown = useMessageCountdown(QUALITY_DROP_NOTICE_MS, hovered || focused, onDone);
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -8, transition: { duration: 0.14 } }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="pointer-events-auto w-[min(26rem,100%)]"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {children(countdown)}
    </motion.div>
  );
}
