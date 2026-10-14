import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { AVATAR_CHARACTERS, AVATAR_COLLECTIONS, avatarsOf, findAvatar } from "@tentacle-tv/shared";
import { Modal } from "../../components/ui/Modal";
import { ModalHeader } from "../../components/ui/ModalHeader";
import { useToast } from "../../contexts/ToastContext";
import { ACCOUNT_TARGET, useAvatarTarget, type AvatarTarget } from "./useAvatarTarget";
import { AvatarTile } from "./AvatarTile";
import { UploadTile } from "./UploadTile";
import { AvatarStoryPanel } from "./AvatarStoryPanel";
import { GallerySection } from "./GallerySection";
import { fetchAvatarImage } from "./avatarImages";
import { nextTileIndex } from "./gridKeys";
import "./avatarGallery.css";

/** `change` : ouverte par l'utilisateur ; `invite` : l'invitation unique du bureau. */
export type AvatarGalleryMode = "change" | "invite";

interface AvatarGalleryDialogProps {
  open: boolean;
  mode: AvatarGalleryMode;
  /** À qui donner la photo : le compte (défaut), ou un invité de la Famille. */
  target?: AvatarTarget;
  onClose: () => void;
}

const FIRST_TILE = AVATAR_CHARACTERS[0]?.id ?? "upload";

/**
 * La galerie des photos de profil : « Importer une photo » en tête, puis la
 * troupe, collection par collection. Survoler (ou parcourir au clavier) un
 * personnage le présente au pied ; un clic (ou Entrée) le désigne, « Choisir
 * … » — ou un second clic sur le désigné — l'envoie comme photo Jellyfin du
 * compte, exactement comme une photo importée. Flèches, Début et Fin dans la
 * grille (tabulation itinérante) ; le premier focus va au premier personnage,
 * jamais à la croix.
 */
export default function AvatarGalleryDialog({ open, mode, target = ACCOUNT_TARGET, onClose }: AvatarGalleryDialogProps) {
  const { t } = useTranslation("avatars");
  const { t: tProfile } = useTranslation("profile");
  const { show } = useToast();
  const { currentSrc, initial, upload, uploading } = useAvatarTarget(target);
  const titleId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [rovingId, setRovingId] = useState(FIRST_TILE);
  const [applying, setApplying] = useState(false);
  // Un envoi à la fois, même entre deux rendus (deux clics rapprochés).
  const inFlight = useRef(false);
  const busy = applying || uploading;

  useEffect(() => {
    if (!open) return;
    setChosenId(null);
    setPreviewId(null);
    setRovingId(FIRST_TILE);
  }, [open]);

  const send = useCallback(async (image: () => Promise<Blob>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setApplying(true);
    const ok = await image().then(upload, () => false);
    inFlight.current = false;
    setApplying(false);
    show(ok ? "success" : "error", tProfile(ok ? "avatarUpdated" : "avatarUpdateFailed"));
    if (ok) onClose();
  }, [upload, show, tProfile, onClose]);

  const apply = useCallback((id: string) => {
    void send(() => fetchAvatarImage(id));
  }, [send]);

  // Un clic (ou Entrée) sur le personnage déjà désigné : on le prend.
  const choose = useCallback((id: string) => {
    if (chosenId === id) apply(id);
    else setChosenId(id);
  }, [chosenId, apply]);

  const onFile = useCallback((file: File) => {
    void send(async () => file);
  }, [send]);

  const onGridKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const grid = gridRef.current;
    const target = event.target as HTMLElement;
    if (!grid || !target.dataset.avatarTile) return;
    const tiles = Array.from(grid.querySelectorAll<HTMLElement>("[data-avatar-tile]"));
    const boxes = tiles.map((tile) => {
      const rect = tile.getBoundingClientRect();
      return { top: rect.top, center: rect.left + rect.width / 2 };
    });
    const next = nextTileIndex(boxes, tiles.indexOf(target), event.key);
    if (next === null) return;
    event.preventDefault();
    tiles[next].focus();
    tiles[next].scrollIntoView({ block: "nearest" });
  }, []);

  const initialFocus = useCallback(
    () => gridRef.current?.querySelector<HTMLElement>(`[data-avatar-tile="${rovingId}"]`),
    [rovingId],
  );

  const shown = findAvatar(previewId ?? chosenId ?? "") ?? null;
  const chosenName = chosenId ? t(`characters.${chosenId}.name`) : null;
  const invite = mode === "invite";
  // Un invité habillé depuis Réglages › Famille : sa photo, à son nom. Pendant
  // SA session, c'est la sienne — les mots du compte.
  const guestName = target.kind === "guest" && target.through === "session" ? target.name : null;

  return (
    <Modal open={open} onClose={onClose} maxWidth={880} labelledBy={titleId} initialFocus={initialFocus}>
      <ModalHeader
        titleId={titleId}
        title={invite ? t("invite.title") : guestName ? t("guest.title", { name: guestName }) : t("title")}
        subtitle={
          invite ? (
            <span>
              <span className="mr-2 inline-flex items-center rounded-full bg-[rgba(var(--brand-rgb),0.18)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-light)]">
                {t("invite.eyebrow")}
              </span>
              {t("invite.subtitle", { count: AVATAR_CHARACTERS.length })}
            </span>
          ) : guestName ? (
            t("guest.subtitle", { name: guestName })
          ) : (
            t("subtitle")
          )
        }
        onClose={onClose}
      />
      <div
        ref={gridRef}
        onKeyDown={onGridKeyDown}
        onFocusCapture={(event) => {
          const id = (event.target as HTMLElement).dataset.avatarTile;
          if (id) setRovingId(id);
        }}
        className="max-h-[min(56vh,560px)] overflow-y-auto px-6 pb-2 pt-4"
      >
        <GallerySection title={t("yourPhoto")}>
          <UploadTile tabbable={rovingId === "upload"} disabled={busy} onFile={onFile} />
        </GallerySection>
        {AVATAR_COLLECTIONS.map((collection) => (
          <GallerySection key={collection} title={t(`collections.${collection}`)}>
            {avatarsOf(collection).map((avatar) => (
              <AvatarTile
                key={avatar.id}
                avatar={avatar}
                name={t(`characters.${avatar.id}.name`)}
                chosen={chosenId === avatar.id}
                tabbable={rovingId === avatar.id}
                disabled={busy}
                onChoose={choose}
                onPreview={setPreviewId}
              />
            ))}
          </GallerySection>
        ))}
      </div>
      <div className="flex flex-col gap-4 border-t border-line-subtle px-6 py-4 sm:flex-row sm:items-center">
        <AvatarStoryPanel character={shown} currentSrc={currentSrc} initial={initial} />
        <div className="flex flex-shrink-0 justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-line-subtle bg-fill-soft px-5 text-sm font-semibold text-content-primary outline-none transition hover:bg-fill-medium focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {invite ? t("notNow") : t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => chosenId && apply(chosenId)}
            disabled={!chosenId || busy}
            className="inline-flex h-11 min-w-[9rem] items-center justify-center gap-2 rounded-lg bg-cta-primary-bg px-5 text-sm font-bold text-cta-primary-fg outline-none transition hover:bg-cta-primary-bg-hover focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50"
          >
            {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
            {busy ? t("applying") : chosenName ? t("choose", { name: chosenName }) : t("chooseIdle")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
