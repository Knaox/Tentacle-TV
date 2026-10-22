import { useTranslation } from "react-i18next";
import { EyeOff, Info, Plus } from "lucide-react";
import { useCardToggles } from "@tentacle-tv/api-client";
import {
  cardExtraLabelKey,
  cardToggleLabelKey,
  type CardOverlay,
  type CardToggleHandlers,
  type CardToggleKind,
  type MediaItem,
} from "@tentacle-tv/shared";
import { CardDownloadAction } from "../../downloads/CardDownloadAction";
import { BookmarkGlyph, HeartGlyph, PlayGlyph, WatchedGlyph } from "./cardGlyphs";
import { CardTrayPrimaryButton } from "./CardTrayPrimaryButton";
import { CardTrayButton, CardTrayCapsule } from "./CardTrayParts";

// La capsule et ses boutons vivent dans `CardTrayParts` ; ré-exportés ici,
// où leurs appelants les ont toujours pris.
export { CardTrayButton, CardTrayCapsule };

interface CardActionTrayProps {
  /** Le visage Jellyfin des bascules et du hors ligne — `null` hors bibliothèque. */
  item: MediaItem | null;
  /** Ce que le survol offre (`resolveCardOverlay`) : bascules puis extras, dans l'ordre ; ce que fait le clic. */
  overlay: Pick<CardOverlay, "toggles" | "extras" | "open">;
  /** Nom de la barre d'outils pour les lecteurs d'écran — le titre de la carte. */
  label: string;
  /** `sm` pour les affiches étroites (≤ 140 px), `md` ailleurs, `preview` dans la mini-carte d'aperçu. */
  size?: keyof typeof TRAY_SIZE;
  /** Occupe toute la largeur (affiche) ou épouse son contenu (vignette 16:9). */
  stretch?: boolean;
  /** Extra `details` : ouvrir la fiche d'une carte dont le clic lance la lecture. */
  onOpenDetails?: () => void;
  /** Extra `dismiss` : « Ne plus me proposer ». */
  onDismiss?: () => void;
  /** Bascules d'un titre lu sur le disque : l'état et le geste viennent de l'appelant. */
  localToggles?: CardToggleHandlers;
  /**
   * « Lire » en tête du plateau (`overlay.playInTray`) : le libellé complet
   * (« Reprendre — Dune ») et le geste. Absent : la carte ne lit rien d'ici.
   */
  play?: { label: string; onPlay: () => void } | null;
  /**
   * « Demander » ce qui manque à la série (`overlay.request`), au dégradé de la
   * marque, juste après la lecture : le libellé complet et le geste.
   */
  request?: { label: string; onRequest: () => void } | null;
}

/**
 * Les gabarits des boutons de capsule : une LARGEUR et un carré, jamais une
 * hauteur fixe. Sur une affiche étroite (≤ 160 px), cinq ou six boutons ne
 * tiennent pas à 28 px : ils se resserrent ensemble — `flex-shrink`, la
 * hauteur suit la largeur — au lieu de déborder de la carte. Plancher de
 * 22 px : avec l'écart de 2 px de la capsule, deux centres restent à 24 px,
 * ce que l'exception d'espacement de WCAG 2.5.8 admet ; une affiche de
 * 142 px garde ainsi ses cinq boutons du bureau. Tous les boutons d'une
 * capsule (bascules, action primaire, hors ligne) prennent ce gabarit, et
 * PAS `shrink-0`.
 */
export const TRAY_SIZE = {
  sm: { box: "w-7 min-w-[22px] aspect-square", icon: "h-3.5 w-3.5" },
  md: { box: "w-8 min-w-[22px] aspect-square", icon: "h-4 w-4" },
  // La mini-carte d'aperçu : des ronds à l'échelle de la mini-carte, sans
  // capsule — leur forme vit dans `preview/previewActions.css`.
  preview: { box: "card-preview-btn", icon: "card-preview-icon" },
} as const;

/**
 * Le plateau du survol : « Lire » en tête quand le clic de la carte ne lit
 * pas, « Demander » au dégradé quand une série a des saisons à demander, puis
 * Ma liste, favori, vu, puis ce que la carte ajoute — hors ligne,
 * fiche, refus d'une recommandation — dans UNE capsule, dans l'ordre que fixe
 * le modèle partagé (`cardOverlay.ts`).
 *
 * « Lire » y est DISCRET (`CardTrayPrimaryButton`, ton `quiet`) : un bouton
 * du gabarit de ses voisins, un verre un peu plus dense, sans couleur. Le
 * gros bouton au dégradé qui trônait au centre de l'image a été retiré.
 *
 * La capsule reprend, dans le même ordre et avec les mêmes glyphes, la
 * pastille d'états du repos : l'état qu'on voyait se retrouve exactement là
 * où on le bascule.
 *
 * Posée sur le voile sombre du survol (≥ 0,9 d'alpha en bas) : pas de
 * `backdrop-filter`, il n'y aurait rien de visible à flouter. Un blanc à 12 %
 * et un liseré suffisent à dessiner le verre.
 */
export function CardActionTray({
  item,
  overlay,
  label,
  size = "md",
  stretch = false,
  onOpenDetails,
  onDismiss,
  localToggles,
  play,
  request,
}: CardActionTrayProps) {
  const { t } = useTranslation("cards");
  const { box, icon } = TRAY_SIZE[size];
  const sizes = { box, icon };

  return (
    <CardTrayCapsule label={label} stretch={stretch} bare={size === "preview"}>
      {play && (
        <CardTrayPrimaryButton box={box} icon={icon} tone="quiet" label={play.label} onPress={play.onPlay}>
          <PlayGlyph className={icon} />
        </CardTrayPrimaryButton>
      )}
      {request && (
        <CardTrayPrimaryButton box={box} icon={icon} tone="brand" label={request.label} onPress={request.onRequest}>
          <Plus className={icon} strokeWidth={2.5} aria-hidden />
        </CardTrayPrimaryButton>
      )}
      {overlay.toggles.length > 0 &&
        (localToggles ? (
          <CardTrayToggleButtons toggles={overlay.toggles} handlers={localToggles} {...sizes} />
        ) : item ? (
          <ServerTrayToggles item={item} toggles={overlay.toggles} {...sizes} />
        ) : null)}
      {overlay.extras.map((extra) => {
        if (extra === "offline") {
          // Bureau ET droit, sinon PAS rendu (ni grisé, ni cadenas). Même
          // gabarit rond : il s'aligne dans la capsule comme un bouton de plus.
          return item ? <CardDownloadAction key={extra} item={item} tone="tray" tray={sizes} /> : null;
        }
        const onPress = extra === "details" ? onOpenDetails : onDismiss;
        // « Plus d'infos » sans geste propre, sur une carte dont le clic OUVRE
        // la fiche (la mini-carte d'aperçu d'une affiche) : le bouton laisse
        // son clic remonter jusqu'à elle. Jamais là où le clic lit.
        const passToCard = !onPress && extra === "details" && overlay.open === "details";
        if (!onPress && !passToCard) return null;
        return (
          <CardTrayButton key={extra} box={box} pressable={false} extra={extra} label={t(cardExtraLabelKey(extra))} onPress={onPress}>
            {extra === "details" ? <Info className={icon} aria-hidden /> : <EyeOff className={icon} aria-hidden />}
          </CardTrayButton>
        );
      })}
    </CardTrayCapsule>
  );
}

interface TogglesProps {
  toggles: readonly CardToggleKind[];
  box: string;
  icon: string;
}

/**
 * Les bascules lues sur le serveur. Composant à part : `useCardToggles`
 * s'abonne aux Sets de séries, et une carte hors bibliothèque — ou lue sur le
 * disque — n'a rien à y lire.
 */
function ServerTrayToggles({ item, ...rest }: TogglesProps & { item: MediaItem }) {
  const state = useCardToggles(item);
  return <CardTrayToggleButtons {...rest} handlers={{ states: state.states, onToggle: state.toggle }} />;
}

/** Les boutons des bascules, quelle que soit la source de leur état. */
function CardTrayToggleButtons({ toggles, box, icon, handlers }: TogglesProps & { handlers: CardToggleHandlers }) {
  const { t } = useTranslation("cards");
  return (
    <>
      {toggles.map((kind) => {
        const active = handlers.states[kind];
        return (
          <CardTrayButton
            key={kind}
            box={box}
            active={active}
            accent={kind === "favorite"}
            label={t(cardToggleLabelKey(kind, active))}
            onPress={() => handlers.onToggle(kind)}
          >
            <ToggleGlyph kind={kind} className={icon} filled={active} />
          </CardTrayButton>
        );
      })}
    </>
  );
}

/** Le glyphe d'une bascule — celui de la pastille d'états du repos. */
export function ToggleGlyph({ kind, className, filled }: { kind: CardToggleKind; className: string; filled: boolean }) {
  if (kind === "watchlist") return <BookmarkGlyph className={className} filled={filled} />;
  if (kind === "favorite") return <HeartGlyph className={className} filled={filled} />;
  return <WatchedGlyph className={className} filled={filled} />;
}
