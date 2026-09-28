import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { HardDrive } from "lucide-react";
import { fadeUp } from "../../theme/motion";

/**
 * La ligne qui dit, dans la scène, ce qui est sur la machine : « Sur cet
 * appareil · Original · 4,2 Gio », ou « … · 2 saisons · 14 épisodes · … »
 * pour une série. Posée sur le décor : jetons `on-media` dans les deux thèmes,
 * comme la ligne de faits juste au-dessus.
 *
 * Un seul paragraphe : chaque morceau est insécable et garde son point collé
 * à gauche — une fenêtre étroite coupe APRÈS un point, jamais devant un morceau.
 */
export function OfflineDeviceLine({ parts }: { parts: ReadonlyArray<string | null> }) {
  const { t } = useTranslation("downloads");
  const shown = parts.filter((part): part is string => part !== null && part !== "");
  return (
    <motion.p
      variants={fadeUp}
      className="mt-3 text-sm leading-relaxed text-on-media-secondary drop-shadow-[0_1px_4px_var(--on-media-shadow)]"
    >
      <HardDrive aria-hidden className="mr-2 inline-block h-4 w-4 -translate-y-px align-middle text-[var(--brand-light)]" strokeWidth={1.8} />
      <span className="whitespace-nowrap font-semibold text-on-media-primary">{t("heroLabel")}</span>
      {shown.map((part) => (
        <span key={part}>
          <span aria-hidden className="whitespace-nowrap text-on-media-muted">{"\u00A0·"}</span>{" "}
          <span className="whitespace-nowrap tabular-nums">{part}</span>
        </span>
      ))}
    </motion.p>
  );
}
