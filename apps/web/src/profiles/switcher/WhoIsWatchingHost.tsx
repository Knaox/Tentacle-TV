import { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { useActiveProfile } from "../../auth/profileSession";
import { dropAllSessions } from "../../auth/dropSessions";
import { focusableIn } from "../../components/ui/Modal";
import { useWatchTogether } from "../../watchTogether/WatchTogetherProvider";
import { ProfileLaunchScreen, type SwitchContext } from "../launch/ProfileLaunchScreen";
import { usePublishStartupWindow } from "../../startup/startupStore";
import {
  closeSwitchScreen,
  resetSwitchScreen,
  settleSwitchScreen,
  useSwitchScreenPhase,
  type SwitchScreenPhase,
} from "./switchScreenStore";

/** L'entrée (fondu, `fadeIn`) et la sortie, plus courte — les fondus des modales. */
const ENTER_MS = 200;
const EXIT_MS = 150;

/**
 * « Changer de profil » (bureau) : « Qui regarde ? » plein écran, posé SUR
 * l'application — monté une fois par `AppLayout`, ouvert depuis le menu de
 * l'avatar ou la feuille de la fenêtre étroite (`switchScreenStore.ts`). Le
 * même écran qu'à l'ouverture (`ProfileLaunchScreen`, mode `switching`) :
 * mêmes profils, même pavé du code PIN, même bascule ; en plus, « Annuler »
 * et Échap rendent la page telle qu'on l'avait laissée — rien n'est démonté
 * dessous (lecture en PiP, Watch Together, défilement), seulement plus peint
 * tant que l'écran la couvre.
 *
 * Sous la bande de la fenêtre macOS (`--hote-bandeau`), jamais par-dessus :
 * la fenêtre reste déplaçable. Fermé, il ne rend rien. Ouvert, il est la
 * première fenêtre du démarrage (`startup/startupOrder.ts`) : rien ne paraît
 * par-dessus, ce qui attendait paraît après.
 */
export function WhoIsWatchingHost() {
  const phase = useSwitchScreenPhase();
  usePublishStartupWindow("profileSwitch", "profile", phase === "closed" ? "done" : "open");
  // La coquille démontée (déconnexion, page sans coquille) : l'écran avec elle.
  useEffect(() => resetSwitchScreen, []);
  if (phase === "closed") return null;
  return createPortal(<SwitchScreen phase={phase} />, document.body);
}

function SwitchScreen({ phase }: { phase: Exclude<SwitchScreenPhase, "closed"> }) {
  const { t } = useTranslation("profilePicker");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const queryClient = useQueryClient();
  const active = useActiveProfile();
  const { isInGroup, actions } = useWatchTogether();
  const panelRef = useRef<HTMLDivElement>(null);

  // La fin de chaque fondu fait avancer la phase (`shown` : la page dessous n'est plus peinte).
  useEffect(() => {
    if (phase !== "opening" && phase !== "closing") return;
    const timer = window.setTimeout(settleSwitchScreen, phase === "opening" ? ENTER_MS : EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // La page ne défile pas dessous (sa barre passerait par-dessus l'écran, la molette la ferait bouger à l'aveugle).
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  // Tab et Maj+Tab bouclent dans l'écran, comme dans une modale (`Modal`).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (event.key !== "Tab" || !panel) return;
      const items = focusableIn(panel);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const current = document.activeElement;
      const inside = current instanceof HTMLElement && panel.contains(current);
      if (inside && current !== (event.shiftKey ? first : last)) return;
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const leaveGroup = useCallback(() => actions.leave(), [actions]);
  const onDone = useCallback((landing?: string) => {
    closeSwitchScreen();
    if (landing) navigate(landing);
  }, [navigate]);
  // La session personnelle refusée : elle est morte, et le profil qu'elle avait ouvert avec elle.
  const onAccountLost = useCallback(() => dropAllSessions(client, queryClient), [client, queryClient]);
  const switching = useMemo<SwitchContext>(
    () => ({ activeProfileId: active?.id ?? null, onCancel: closeSwitchScreen, leaveGroup: isInGroup ? leaveGroup : undefined }),
    [active, isInGroup, leaveGroup],
  );

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("whoIsWatching")}
      className="fixed inset-x-0 bottom-0 z-[8000] overflow-y-auto overscroll-contain bg-surface-0"
      style={{
        top: "var(--hote-bandeau, 0px)",
        opacity: phase === "closing" ? 0 : 1,
        animation: phase === "opening" ? `fadeIn ${ENTER_MS}ms ease-out both` : undefined,
        transition: phase === "closing" ? `opacity ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1)` : undefined,
      }}
    >
      <ProfileLaunchScreen initialListing={null} onDone={onDone} onAccountLost={onAccountLost} switching={switching} />
    </div>
  );
}
