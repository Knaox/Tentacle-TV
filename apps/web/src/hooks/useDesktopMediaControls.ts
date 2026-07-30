import { useSmtc } from "./useSmtc";

interface Args {
  title: string;
  subtitle?: string;
  posterUrl?: string;
  paused: boolean;
  togglePause: () => void;
  setPause: (paused: boolean) => Promise<void>;
  goBack: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

/**
 * Contrôles média du système, câblés sur le lecteur desktop.
 *
 * Sous Windows, c'est SMTC : les touches média du clavier, l'incrustation de
 * volume du système, et tout ce qui parle ce protocole — un Stream Deck, une
 * télécommande Bluetooth. Ailleurs, `useSmtc` ne fait rien.
 *
 * Extrait de `DesktopPlayer` (limite de 300 lignes par fichier) : ce n'est que de
 * la correspondance entre deux vocabulaires, et elle n'a pas besoin du reste du
 * composant pour être lue.
 */
export function useDesktopMediaControls({
  title, subtitle, posterUrl, paused, togglePause, setPause, goBack,
  onNext, onPrevious, hasNext, hasPrevious,
}: Args): void {
  useSmtc({
    title,
    artist: subtitle,
    cover: posterUrl,
    paused,
    onToggle: togglePause,
    onPlay: () => setPause(false),
    onPause: () => setPause(true),
    onStop: goBack,
    onNext: hasNext ? onNext : undefined,
    onPrevious: hasPrevious ? onPrevious : undefined,
  });
}
