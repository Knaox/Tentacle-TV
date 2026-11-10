import { useRef, useState } from "react";
import { useWatchTogether } from "./WatchTogetherProvider";
import { WatchTogetherPanel } from "./WatchTogetherPanel";
import { useActiveProfile } from "../auth/profileSession";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { useTranslation } from "react-i18next";
import { FloatingLayer } from "../components/floating/FloatingLayer";

interface WatchTogetherButtonProps {
  dropdownPosition?: "below" | "right";
}

/**
 * Icône header Watch Together — dropdown panneau (motif `NotificationBell`).
 *
 * La pastille dit deux choses, jamais les deux à la fois : un COMPTEUR violet
 * pulsé quand des invitations attendent (« +2 »), un point vert fixe quand on
 * est déjà dans un groupe. Le compteur remplace le point d'avant : « il se
 * passe quelque chose » ne disait pas combien, et une invitation reçue alors
 * qu'on en avait déjà une ne changeait rien à l'écran.
 */
export function WatchTogetherButton(props: WatchTogetherButtonProps) {
  // Bureau, session d'un profil INVITÉ : le serveur lui refuse Watch Together.
  // Un compte sans Watch Together (SyncPlayAccess « Interdit ») n'en voit rien non plus.
  const profile = useActiveProfile();
  const { mayJoin } = useWatchTogether();
  return profile?.kind === "guest" || !mayJoin ? null : <WatchTogetherControl {...props} />;
}

function WatchTogetherControl({ dropdownPosition = "below" }: WatchTogetherButtonProps) {
  const { invites, isInGroup } = useWatchTogether();
  const { t } = useTranslation("watchTogether");
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        // Le bouton rond du socle ; en groupe, il s'ALLUME : icône pleine, teinte franche.
        className="icon-btn relative"
        aria-label={t("title")}
        title={t("title")}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-on={isInGroup || undefined}
      >
        <UsersThreeIcon size={20} weight={isInGroup ? "fill" : "regular"} aria-hidden />
        {invites.length > 0 ? (
          <span
            // Au-delà de neuf, le compte exact n'apprend plus rien et la
            // pastille déborderait du bouton.
            // Une pastille à la teinte franche, immobile : plus de lueur qui bat en permanence
            // dans la barre (une animation infinie pour un compteur).
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-[10px] font-bold leading-none tabular-nums text-accent-on"
          >
            +{Math.min(invites.length, 9)}
          </span>
        ) : null}
      </button>

      {/* Le calque commun : jamais coupé par la fenêtre (la modale de salle vit hors du panneau). */}
      <FloatingLayer
        open={open}
        anchor={buttonRef}
        onDismiss={() => setOpen(false)}
        side={dropdownPosition === "right" ? "right" : "bottom"}
        align="end"
        // Un menu du socle : opaque (plus de flou derrière un fond plein), suit le thème ; en
        // verre natif, `lg-menu` prend la main.
        className="lg-menu lg-menu-wide ui-menu w-96 overflow-y-auto overscroll-contain !p-0"
      >
        <WatchTogetherPanel onClose={() => setOpen(false)} />
      </FloatingLayer>
    </div>
  );
}
