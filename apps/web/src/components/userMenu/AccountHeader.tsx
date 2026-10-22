import type { CSSProperties, ReactNode } from "react";

interface AccountHeaderProps {
  avatar: ReactNode;
  ringStyle: CSSProperties;
  name: string;
  caption: string;
  uploading: boolean;
  onChangePhoto: () => void;
}

/**
 * En-tête du menu de l'avatar en session PERSONNELLE : qui l'on est. Le rond
 * cliquable ouvre la galerie des photos de profil. Sans filet : le bloc
 * d'identité (`UserAvatarMenu`) pose « Changer de profil » dessous et trace
 * le filet sous l'ensemble.
 */
export function AccountHeader({ avatar, ringStyle, name, caption, uploading, onChangePhoto }: AccountHeaderProps) {
  return (
    <div className="lg-menu-header flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onChangePhoto}
        disabled={uploading}
        aria-label={caption}
        title={caption}
        className="group relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold text-cta-brand-fg"
        style={ringStyle}
      >
        {avatar}
        {/* Scrim posé sur la photo de profil (image ou fallback) : reste noir/blanc
            dans les deux thèmes, cf. règle "posé sur une image". */}
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {uploading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <CameraIcon />
          )}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-content-primary">{name || "—"}</p>
        <p className="text-xs text-content-quaternary">{caption}</p>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
