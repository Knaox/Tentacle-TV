import { useTranslation } from "react-i18next";
import { Check, ImagePlus, X } from "lucide-react";
import { Place, type Animated } from "../Place";
import { SCENE_CAST, sceneThumbUrl } from "./avatarSceneCast";

/** La galerie, à l'échelle du canevas : ~500 × 300, centrée sous la barre. */
export const GALLERY = { x: 70, y: 30, w: 500, h: 300 } as const;
const TILE = { art: 48, w: 66, x: 20, y: 171 } as const;

/** Le centre du rond du personnage `index` de la rangée des abysses (la cible du pointeur). */
export function castTileCenter(index: number): { x: number; y: number } {
  return { x: GALLERY.x + TILE.x + index * TILE.w + TILE.w / 2, y: GALLERY.y + TILE.y + TILE.art / 2 };
}

interface FauxAvatarGalleryProps extends Animated {
  /** Le personnage sous le pointeur : il s'élève, son histoire paraît au pied. */
  hovered: number | null;
  /** Le personnage choisi : l'anneau de marque, la coche, « Choisir … ». */
  chosen: number | null;
}

/**
 * La galerie des photos de profil, en faux, au balisage de
 * `profiles/avatarGallery/` (recopié : le client LG ne compile pas
 * `profiles/`) : le titre et sa phrase, « Votre photo » et son import, la
 * première rangée des abysses — les vraies vignettes, sur la couleur de leur
 * fond —, puis le pied : le personnage présenté (portrait, nom, histoire) et
 * « Annuler » / « Choisir … ». Fond plein de modale, sans flou (règle du kit).
 */
export function FauxAvatarGallery({ hovered, chosen, ...animated }: FauxAvatarGalleryProps) {
  const { t } = useTranslation(["avatars"]);
  const shown = hovered ?? chosen;
  const character = shown === null ? null : SCENE_CAST[shown];
  const chosenName = chosen === null ? null : t(`avatars:characters.${SCENE_CAST[chosen].id}.name`);
  return (
    <Place x={GALLERY.x} y={GALLERY.y} w={GALLERY.w} h={GALLERY.h} style={{ zIndex: 15 }} {...animated}>
      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-line-subtle bg-[var(--surface-modal)] shadow-2xl">
        <p className="absolute left-5 top-3.5 text-[14px] font-semibold text-content-primary">{t("avatars:title")}</p>
        <p className="absolute left-5 right-10 top-[34px] truncate text-[10px] text-content-tertiary">{t("avatars:subtitle")}</p>
        <X size={14} aria-hidden className="absolute right-4 top-4 text-content-tertiary" />
        <div className="absolute inset-x-0 top-[54px] border-t border-line-subtle" />
        <p className="absolute left-5 top-[60px] text-[8px] font-semibold uppercase tracking-[0.12em] text-content-quaternary">{t("avatars:yourPhoto")}</p>
        <div className="absolute flex flex-col items-center" style={{ left: TILE.x, top: 72, width: TILE.w }}>
          <span className="flex items-center justify-center rounded-full border-2 border-dashed border-line-strong bg-fill-soft text-content-secondary" style={{ width: TILE.art, height: TILE.art }}>
            <ImagePlus size={17} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="mt-1 line-clamp-2 max-w-full text-center text-[9px] font-medium leading-[11px] text-content-tertiary">{t("avatars:upload")}</span>
        </div>
        <p className="absolute left-5 top-[150px] text-[8px] font-semibold uppercase tracking-[0.12em] text-content-quaternary">{t("avatars:collections.abyss")}</p>
        {SCENE_CAST.map((avatar, i) => (
          <div key={avatar.id} className="absolute flex flex-col items-center" style={{ left: TILE.x + i * TILE.w, top: TILE.y, width: TILE.w }}>
            <Place x={(TILE.w - TILE.art) / 2} y={0} w={TILE.art} h={TILE.art} dy={hovered === i ? -3 : 0} scale={hovered === i ? 1.06 : 1}>
              <Place x={-4} y={-4} w={TILE.art + 8} h={TILE.art + 8} visible={chosen === i} className="rounded-full" style={{ boxShadow: "0 0 0 2.5px var(--brand)" }} />
              <span className="block h-full w-full overflow-hidden rounded-full" style={{ background: avatar.tone }}>
                <img src={sceneThumbUrl(avatar.id)} alt="" draggable={false} className="h-full w-full object-cover" />
              </span>
              <Place x={TILE.art - 15} y={TILE.art - 15} w={17} h={17} visible={chosen === i} className="flex items-center justify-center rounded-full border-2 border-[var(--surface-modal)] bg-[var(--brand)] text-cta-brand-fg">
                <Check size={9} strokeWidth={3} aria-hidden />
              </Place>
            </Place>
            <span className={`mt-[52px] max-w-full truncate text-[9px] font-medium ${chosen === i ? "text-content-primary" : "text-content-tertiary"}`}>
              {t(`avatars:characters.${avatar.id}.name`)}
            </span>
          </div>
        ))}
        <div className="absolute inset-x-0 top-[242px] border-t border-line-subtle" />
        <span className="absolute left-5 top-[251px] flex h-10 w-10 items-center justify-center overflow-hidden rounded-full" style={{ background: character?.tone ?? "linear-gradient(135deg, var(--brand-dark), var(--brand))" }}>
          {character && <img src={sceneThumbUrl(character.id)} alt="" draggable={false} className="h-full w-full object-cover" />}
        </span>
        <div className="absolute left-[72px] right-[190px] top-[251px]">
          <p className="truncate text-[12px] font-semibold text-content-primary">{character ? t(`avatars:characters.${character.id}.name`) : t("avatars:noPhoto")}</p>
          <p className="line-clamp-2 text-[10px] leading-snug text-content-tertiary">{character ? t(`avatars:characters.${character.id}.story`) : t("avatars:pickHint")}</p>
        </div>
        <span className="absolute right-[104px] top-[257px] inline-flex h-7 items-center rounded-lg border border-line-subtle bg-fill-soft px-3 text-[11px] font-semibold text-content-primary">{t("avatars:cancel")}</span>
        <span className={`absolute right-5 top-[257px] inline-flex h-7 min-w-[78px] items-center justify-center rounded-lg bg-cta-primary-bg px-3 text-[11px] font-bold text-cta-primary-fg ${chosen === null ? "opacity-50" : ""}`}>
          {chosenName ? t("avatars:choose", { name: chosenName }) : t("avatars:chooseIdle")}
        </span>
      </div>
    </Place>
  );
}
