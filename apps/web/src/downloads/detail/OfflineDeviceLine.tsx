import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { HardDrive } from "lucide-react";
import { fadeUp } from "../../theme/motion";

/**
 * La ligne qui dit, dans la scène, ce qui est sur la machine : « Sur cet
 * appareil · Original · 4,2 Gio », ou « … · 2 saisons · 14 épisodes · … »
 * pour une série. Posée sur le décor : jetons `on-media` dans les deux thèmes,
 * comme la ligne de faits juste au-dessus.
 */
export function OfflineDeviceLine({ parts }: { parts: ReadonlyArray<string | null> }) {
  const { t } = useTranslation("downloads");
  const shown = parts.filter((part): part is string => part !== null && part !== "");
  return (
    <motion.p
      variants={fadeUp}
      className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-on-media-secondary drop-shadow-[0_1px_4px_var(--on-media-shadow)]"
    >
      <HardDrive aria-hidden className="h-4 w-4 text-[var(--brand-light)]" strokeWidth={1.8} />
      <span className="font-semibold text-on-media-primary">{t("heroLabel")}</span>
      {shown.map((part) => (
        <Fragment key={part}>
          <span aria-hidden className="text-on-media-muted">·</span>
          <span className="tabular-nums">{part}</span>
        </Fragment>
      ))}
    </motion.p>
  );
}
