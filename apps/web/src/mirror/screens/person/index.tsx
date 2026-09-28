import { useCallback, useMemo, useRef, type CSSProperties } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { withoutLibraryTwins, type ExternalSearchItem, type SearchProvider } from "@tentacle-tv/shared";
import { usePersonPage } from "../../../components/person/usePersonPage";
import { CardSheetProvider } from "../../cards/CardSheetProvider";
import { useViewport } from "../../useFormFactor";
import { DETAIL_MAX_WIDTH } from "../../responsive";
import { DetailTopBar } from "../detail/DetailTopBar";
import { useDetailScroll } from "../detail/useDetailScroll";
import { ExternalSections } from "../search/SearchExternal";
import { PersonHeader } from "./PersonHeader";
import { PersonBio, PersonFilmography } from "./PersonBody";
import "../../mirror.css";
import "../detail/detail.css";

const BOTTOM_PAD = "calc(72px + env(safe-area-inset-bottom))";

/**
 * L'écran d'une personne du miroir (`/person/:personId`) — `PersonScreen` de
 * l'app : décor FIXE emprunté à son titre le mieux noté (ni parallaxe ni
 * Ken Burns), portrait à cheval dessus, vie, biographie, filmographie en
 * bibliothèque puis ce que les extensions connaissent. Hors de la coquille,
 * comme la fiche : la barre haute porte le retour.
 */
export function MirrorPerson() {
  const { personId } = useParams<{ personId: string }>();
  if (!personId) return null;
  // L'hôte de la feuille d'appui long des affiches de la filmographie.
  return (
    <CardSheetProvider>
      <PersonScreen key={personId} personId={personId} />
    </CardSheetProvider>
  );
}

function PersonScreen({ personId }: { personId: string }) {
  const { t } = useTranslation("media");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const client = useJellyfinClient();
  const { width, height, formFactor } = useViewport();
  const isTablet = formFactor === "tablet";
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const page = usePersonPage(personId, params.get("role"));

  const backdropH = Math.min(isTablet ? 460 : 340, Math.round(height * 0.42));
  const portraitW = Math.min(isTablet ? 160 : 120, Math.round(width * 0.3));
  useDetailScroll(scrollerRef, hostRef, backdropH * 0.62, true);

  const backdropUrl = page.backdrop ? client.getImageUrl(page.backdrop.Id, "Backdrop", { width: 1200, quality: 80 }) : null;
  const name = page.details.data?.Name ?? "";
  const kind = page.kind;
  const outside = useMemo(() => page.external.results
    .map((result) => ({
      ...result,
      items: withoutLibraryTwins(result.items, page.owned).filter((item) => kind === "all" || item.kind === kind),
    }))
    .filter((result) => result.items.length > 0), [page.external.results, page.owned, kind]);
  const openItem = useCallback((id: string) => navigate(`/media/${id}`), [navigate]);
  const openExternal = useCallback((_p: SearchProvider, item: ExternalSearchItem) => navigate(item.href), [navigate]);
  const seeAll = useCallback((_p: SearchProvider, href: string) => navigate(href), [navigate]);

  return (
    <div ref={hostRef} className="fixed inset-0 bg-surface-0" style={{ ["--bh" as string]: backdropH } as CSSProperties}>
      <div
        ref={scrollerRef}
        className="mirror-no-scrollbar h-full overflow-y-auto overflow-x-hidden overscroll-y-contain"
        style={{ paddingBottom: BOTTOM_PAD }}
      >
        <div className="relative w-full overflow-hidden" style={{ height: backdropH }}>
          {backdropUrl && (
            <img src={backdropUrl} alt="" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover opacity-70" />
          )}
          <div
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{
              height: "calc(120px + env(safe-area-inset-top))",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--surface-0) 85%, transparent) 0%, color-mix(in srgb, var(--surface-0) 40%, transparent) 35%, transparent 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{ height: backdropH * 0.85, background: "var(--detail-scrim-bottom)" }}
          />
        </div>

        <div className="mx-auto w-full" style={{ maxWidth: DETAIL_MAX_WIDTH }}>
          {page.details.data && (
            <PersonHeader
              id={personId}
              name={name}
              imageTag={page.details.data.ImageTags?.Primary ?? null}
              life={page.life}
              roles={page.facets.roles.map((r) => r.role).filter((r) => r !== "Other")}
              countLabel={page.countLabel}
              portraitW={portraitW}
              like={page.like}
            />
          )}
          {page.details.isError && !page.details.data && (
            <p className="px-4 text-[15px] font-medium text-content-secondary">{t("personLoadError")}</p>
          )}
          <PersonBio overview={page.details.data?.Overview} />
          <PersonFilmography
            pending={page.filmography.isPending}
            entries={page.entries}
            shown={page.shown}
            facets={page.facets}
            kind={page.kind}
            role={page.role}
            onKind={page.setKind}
            onRole={page.setRole}
            onOpen={openItem}
          />
          {outside.length > 0 && <ExternalSections results={outside} onOpen={openExternal} onSeeAll={seeAll} layout="grid" />}
        </div>
      </div>
      <DetailTopBar title={name} />
    </div>
  );
}
