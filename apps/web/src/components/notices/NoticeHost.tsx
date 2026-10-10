import { memo, useCallback, useEffect, useState, type ReactElement } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  closeNoticeForSession, noticeContent, useClientNotice, useClosedNotices, useSetHintDismissed, type ClientNotice,
} from "@tentacle-tv/api-client";
import {
  noticeAutoHideMs, noticeRule, suppressedNotices, NOTICE_AUTO_HIDE_MS,
  type DismissibleHint, type NoticeId, type NoticeSeverity,
} from "@tentacle-tv/shared";
import { MIN_SERVER_VERSION, useServerCompat } from "../../hooks/useServerCompat";
import { useMessageCountdown } from "../session/useMessageCountdown";
import { getUserInfo } from "../userMenu/menuItems";
import { NoticeCard, type NoticeCardAction, type NoticeIcon } from "./NoticeCard";
import { duration, exitDuration } from "../../theme/motion";

/** Une fois masqué pour de bon : la phrase qui le dit, et « Annuler ». */
interface Confirmation {
  id: NoticeId;
  hint: DismissibleHint;
  text: string;
}

/**
 * Les avertissements surgissants du web, du miroir et du bureau — la
 * politique partagée rendue (`notices/noticePolicy.ts`) : un seul à la fois,
 * sous l'en-tête, administrateurs seulement ; jamais sur le lecteur (sa route
 * est hors des coquilles qui le montent). Une recommandation s'efface seule
 * (6 s, suspendues au survol, au focus et fenêtre cachée) ; « Ne plus
 * afficher » est une préférence du COMPTE, offerte si le serveur sait la
 * retenir. Silence sur le tableau de bord (`/admin`) et sur la page qui règle
 * le problème. Remplace les bandeaux d'avant (serveur, clé admin, TMDB).
 *
 * Essai (développement) — dans la console : `tentacleTestNotice("tmdbKey")`,
 * `("serverUpdate")`, `("serverNews")`, `("adminKey")` ; `(false)` rend la main au vrai état.
 */
export function NoticeHost({ top }: { top: string }) {
  const { t } = useTranslation(["notices", "errors"]);
  const { isAdmin } = getUserInfo();
  const { serverVersion } = useServerCompat();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const real = useClientNotice({
    isAdmin, serverVersion, minServer: MIN_SERVER_VERSION, suppressed: suppressedNotices(pathname),
  });
  const forced = useForcedNotice();
  const notice = forced ?? real;
  const { mutate } = useSetHintDismissed();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const dismissForGood = useCallback((current: ClientNotice, text: string) => {
    const hint = current.rule.hint;
    if (!hint) return;
    setConfirmation({ id: current.id, hint, text });
    mutate({ hint, dismissed: true, mark: current.mark }, {
      onError: () => setConfirmation({ id: current.id, hint, text: t("errors:titleAction") }),
    });
  }, [mutate, t]);

  const undo = useCallback((current: Confirmation) => {
    setConfirmation(null);
    mutate({ hint: current.hint, dismissed: false });
  }, [mutate]);

  let banner: ReactElement | null = null;
  if (confirmation) {
    banner = (
      <Banner
        key={`confirm-${confirmation.id}`}
        severity="info"
        icon="check"
        lines={[confirmation.text]}
        primary={{ label: t("notices:undo"), onClick: () => undo(confirmation) }}
        durationMs={NOTICE_AUTO_HIDE_MS}
        onDone={() => {
          setConfirmation(null);
          closeNoticeForSession(confirmation.id);
        }}
      />
    );
  } else if (notice) {
    const content = noticeContent(notice);
    const dismiss: NoticeCardAction | undefined = notice.canDismiss && content.dismissKey
      ? { label: t(content.dismissKey), onClick: () => dismissForGood(notice, t(content.dismissedKey ?? "")) }
      : undefined;
    banner = (
      <Banner
        key={notice.id}
        severity={notice.rule.severity}
        icon={content.icon}
        title={t(content.titleKey)}
        lines={content.textKeys.map((key) => t(key, notice.values))}
        primary={{
          label: t(content.actionKey),
          onClick: () => {
            closeNoticeForSession(notice.id);
            navigate(content.actionPath);
          },
        }}
        secondary={dismiss}
        durationMs={noticeAutoHideMs(notice.rule.severity)}
        onDone={() => closeNoticeForSession(notice.id)}
      />
    );
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 md:items-end md:px-6"
      style={{ top }}
    >
      <AnimatePresence initial={false}>{banner}</AnimatePresence>
    </div>
  );
}

interface BannerProps {
  severity: NoticeSeverity;
  icon: NoticeIcon;
  title?: string;
  lines: string[];
  primary?: NoticeCardAction;
  secondary?: NoticeCardAction;
  durationMs: number | null;
  onDone: () => void;
}

/** Une carte et son temps : le compte à rebours, que le survol et le focus suspendent. */
const Banner = memo(function Banner({ severity, icon, title, lines, primary, secondary, durationMs, onDone }: BannerProps) {
  const reduced = useReducedMotion() ?? false;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const countdown = useMessageCountdown(durationMs, hovered || focused, onDone);
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -8, transition: { duration: exitDuration(duration.base) } }}
      transition={{ duration: duration.base, ease: "easeOut" }}
      className="pointer-events-auto w-[min(28rem,100%)]"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <NoticeCard
        severity={severity}
        icon={icon}
        title={title}
        lines={lines}
        primary={primary}
        secondary={secondary}
        countdown={countdown}
        durationMs={durationMs}
        onClose={onDone}
      />
    </motion.div>
  );
});

/** Le banc de développement : un avertissement forcé, comme le vrai (même politique, même texte). */
function useForcedNotice(): ClientNotice | null {
  const [forced, setForced] = useState<NoticeId | null>(null);
  const closed = useClosedNotices();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.tentacleTestNotice = (id: NoticeId | false = "tmdbKey") => setForced(id === false ? null : id);
    return () => {
      delete w.tentacleTestNotice;
    };
  }, []);
  if (!forced || closed.has(forced)) return null;
  const rule = noticeRule(forced);
  return {
    id: forced,
    rule,
    values: { server: "1.17.0", required: MIN_SERVER_VERSION },
    canDismiss: rule.hint !== null,
    mark: forced === "serverNews" ? MIN_SERVER_VERSION : undefined,
    adminKeyState: forced === "adminKey" ? "revoquee" : undefined,
  };
}
