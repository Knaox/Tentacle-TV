import { Fragment, type ReactNode } from "react";
import { Info } from "lucide-react";
import { formatCommunityRating } from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, PlayGlyph, StarGlyph, WatchedGlyph } from "../../../components/cards/cardGlyphs";
import { StarRating } from "../../../components/rating/StarRating";
import type { SceneTrailer } from "./previewSceneMedia";
import { ACTION, PREVIEW_W } from "./previewSceneGeometry";

const noop = () => {};
const ROUND = "absolute flex items-center justify-center rounded-full border-[1.5px] text-white";
/** Le point de marque qui sépare les faits et les genres (`card-preview-dot`). */
const Dot = () => <span aria-hidden className="mx-[3px] inline-block h-[3px] w-[3px] rounded-full bg-[var(--brand-light)] align-middle" />;

/**
 * Le CONTENU du bandeau de la mini-carte, en faux (`PreviewPanel`,
 * `previewPanel.css`, `previewActions.css`, réduits) : les actions — « Lire »
 * plein au dégradé de la marque et un cran plus grand, puis Ma liste, favori,
 * vu en ronds cerclés, « Plus d'infos » isolé au bout —, le titre (logo, sinon
 * nom) et ses étoiles, puis « année • classification • ★ note • durée » — la
 * note globale que la mini-carte recouvre sur l'affiche, étoile de marque — et
 * les genres.
 */
export function FauxPreviewBand({ trailer, listed }: { trailer: SceneTrailer; listed: boolean }) {
  const { year, rating, community, runtime } = trailer.facts;
  const facts: ReactNode[] = [];
  if (year) facts.push(<span key="year" className="font-semibold text-white">{year}</span>);
  if (rating) facts.push(<span key="rating" className="rounded-[3px] border border-white/45 px-[3px] text-[7.5px] font-semibold leading-[10px] text-white">{rating}</span>);
  if (community !== null) {
    facts.push(
      <span key="community" className="font-semibold text-white">
        <StarGlyph className="mr-[2px] inline-block h-[8px] w-[8px] align-[-0.08em] text-[var(--brand-accent)]" />
        {formatCommunityRating(community)}
      </span>,
    );
  }
  if (runtime) facts.push(<span key="runtime">{runtime}</span>);
  return (
    <>
      <Actions listed={listed} />
      <div className="absolute flex items-center justify-between" style={{ left: ACTION.x, right: ACTION.x, top: 31, height: 15 }}>
        {trailer.logoUrl ? (
          <img src={trailer.logoUrl} alt="" draggable={false} className="block max-h-[15px] w-auto max-w-[58%] object-contain object-left" />
        ) : (
          <p className="max-w-[58%] truncate text-[10px] font-semibold text-white">{trailer.title}</p>
        )}
        <StarRating value={null} onRate={noop} onClear={noop} size="xs" tone="onMedia" />
      </div>
      {facts.length > 0 && (
        <p className="absolute truncate text-[8.5px] font-medium leading-[12px] text-white/85" style={{ left: ACTION.x, right: ACTION.x, top: 50 }}>
          {facts.map((part, index) => (
            <Fragment key={index}>
              {index > 0 && <Dot />}
              {part}
            </Fragment>
          ))}
        </p>
      )}
      {trailer.genres.length > 0 && (
        <p className="absolute truncate text-[8.5px] font-medium leading-[12px] text-white/65" style={{ left: ACTION.x, right: ACTION.x, top: 62 }}>
          {trailer.genres.map((genre, index) => (
            <Fragment key={genre}>
              {index > 0 && <Dot />}
              {genre}
            </Fragment>
          ))}
        </p>
      )}
    </>
  );
}

function Actions({ listed }: { listed: boolean }) {
  const at = (index: number) => ({
    left: ACTION.x + ACTION.primary + ACTION.gap + (index - 1) * (ACTION.size + ACTION.gap),
    top: ACTION.y + (ACTION.primary - ACTION.size) / 2,
    width: ACTION.size,
    height: ACTION.size,
  });
  const quiet = `${ROUND} border-white/40 bg-white/5`;
  return (
    <>
      <span
        className="absolute flex items-center justify-center rounded-full text-white shadow-[0_5px_12px_-5px_rgba(var(--brand-rgb),0.7)]"
        style={{ left: ACTION.x, top: ACTION.y, width: ACTION.primary, height: ACTION.primary, backgroundImage: "var(--cta-brand-gradient)" }}
      >
        <PlayGlyph className="h-[10px] w-[10px] translate-x-[6%]" />
      </span>
      {/* Une bascule active : le glyphe plein, le cercle un peu plus fermé. */}
      <span className={listed ? `${ROUND} border-white/80 bg-white/15` : quiet} style={at(1)}>
        <BookmarkGlyph className="h-[9px] w-[9px]" filled={listed} />
      </span>
      <span className={quiet} style={at(2)}>
        <HeartGlyph className="h-[9px] w-[9px]" filled={false} />
      </span>
      <span className={quiet} style={at(3)}>
        <WatchedGlyph className="h-[9px] w-[9px]" filled={false} />
      </span>
      <span className={quiet} style={{ ...at(1), left: PREVIEW_W - ACTION.x - ACTION.size }}>
        <Info className="h-[9px] w-[9px]" strokeWidth={2} aria-hidden />
      </span>
    </>
  );
}
