import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus } from "lucide-react";
import { TILE_ART } from "./AvatarTile";

interface UploadTileProps {
  tabbable: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
}

/**
 * « Importer une photo » : la photo personnelle reste à portée, en tête de la
 * galerie. Le fichier part tel quel vers `onFile` (redimensionné à l'envoi par
 * `useAvatarUpload`). Même gabarit qu'une tuile de personnage, pour que la
 * navigation au clavier passe de l'une aux autres.
 */
export function UploadTile({ tabbable, disabled, onFile }: UploadTileProps) {
  const { t } = useTranslation("avatars");
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        data-avatar-tile="upload"
        tabIndex={tabbable ? 0 : -1}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-label={`${t("upload")} — ${t("uploadHint")}`}
        className="avatar-tile flex w-[96px] flex-col items-center gap-2 rounded-2xl pb-1 pt-2 outline-none disabled:cursor-wait"
      >
        <span className="relative block" style={{ width: TILE_ART, height: TILE_ART }}>
          <span
            aria-hidden="true"
            className="avatar-tile__ring avatar-tile__ring--focus absolute -inset-[6px] rounded-full"
            style={{ boxShadow: "0 0 0 2px var(--text-primary)" }}
          />
          <span className="avatar-tile__art flex h-full w-full items-center justify-center rounded-full border-2 border-dashed border-line-strong bg-fill-soft text-content-secondary transition-colors hover:bg-fill-medium">
            <ImagePlus size={28} strokeWidth={1.75} aria-hidden />
          </span>
        </span>
        <span className="line-clamp-2 max-w-full text-center text-xs font-medium leading-tight text-content-tertiary">{t("upload")}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}
