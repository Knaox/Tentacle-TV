// Icônes des contrôles du lecteur, tous superposés à la vidéo → text-white
// volontairement en dur dans les deux thèmes clair/sombre.
export function BackIcon() { return <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>; }
export function PlayIcon() { return <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>; }
export function PauseIcon() { return <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>; }
/**
 * Icône volume à niveaux : le haut-parleur, plus `bars` arcs concentriques
 * (1 = son bas, 2 = moyen, 3 = fort). Le nombre d'ondes suit le volume, comme
 * sur les OSD système. À zéro / coupé, on rend `MuteIcon` à la place.
 */
export function VolumeIcon({ bars = 3 }: { bars?: 1 | 2 | 3 }) {
  return (
    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6l-4 4H4v4h4l4 4V6z" />
      {bars >= 1 && <path strokeLinecap="round" strokeLinejoin="round" d="M15.4 9.4a3.6 3.6 0 010 5.2" />}
      {bars >= 2 && <path strokeLinecap="round" strokeLinejoin="round" d="M18 7a7 7 0 010 10" />}
      {bars >= 3 && <path strokeLinecap="round" strokeLinejoin="round" d="M20.6 4.6a10.5 10.5 0 010 14.8" />}
    </svg>
  );
}
export function MuteIcon() { return <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5.586v12.828a1 1 0 01-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>; }
export function GearIcon() { return <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>; }
export function FullscreenIcon() { return <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" /></svg>; }
export function ExitFullscreenIcon() { return <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 4v4H4M16 4v4h4M8 20v-4H4M16 20v-4h4" /></svg>; }
export function PrevEpIcon() { return <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>; }
export function NextEpIcon() { return <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>; }
export function PipIcon() { return <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="3" width="20" height="14" rx="2" /><rect x="12" y="9" width="8" height="6" rx="1" fill="currentColor" opacity="0.3" /><rect x="12" y="9" width="8" height="6" rx="1" /></svg>; }
export function EpisodesIcon() { return <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h11M4 12h11M4 18h7" /><path d="M16 10.5l5 3-5 3z" fill="currentColor" stroke="none" /></svg>; }
/** Compteur de vitesse : cadran, graduations et aiguille — le réglage de vitesse de lecture. */
export function SpeedIcon() {
  return (
    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 12l4.2-2.8" />
      <path strokeLinecap="round" d="M12 3v1.6M21 12h-1.6M3 12h1.6M5.64 5.64l1.13 1.13M18.36 5.64l-1.13 1.13" />
    </svg>
  );
}
