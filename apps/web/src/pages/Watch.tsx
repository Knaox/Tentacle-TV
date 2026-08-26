import { supportsMpv } from "../desktop/bridge";
import { BandeauLecteurSecours } from "../components/player/BandeauLecteurSecours";
import { signalerBasculeSecours, useLecteurSecours } from "../lib/lecteurSecours";
import { WatchWeb } from "./WatchWeb";
import { WatchDesktop } from "./WatchDesktop";

export function Watch() {
  // Shell doté de mpv (toutes plateformes) → lecteur desktop
  // Navigateur, ou shell sans mpv → lecteur web avec hls.js
  // Si mpv plante (init timeout, erreur native), bascule auto vers le player web
  // (hls.js utilise le webview natif et n'a pas la dépendance libmpv).
  //
  // La porte est `supportsMpv()` et non « suis-je sur le bureau » : pendant la
  // migration, la coquille Electron est une app de bureau qui n'a pas encore
  // son adaptateur mpv. Sans cette distinction, elle partait sur le lecteur
  // natif et n'avait personne au bout du fil.
  //
  // La bascule vit dans un store de session (`lib/lecteurSecours.ts`) et non
  // dans un état local : naviguer vers un autre film ne doit pas repayer
  // l'échec de mpv — et le bandeau DIT ce qui s'est passé.
  const secours = useLecteurSecours();
  if (supportsMpv() && !secours) {
    return <WatchDesktop onFallbackToWeb={signalerBasculeSecours} />;
  }
  return (
    <>
      {secours ? <BandeauLecteurSecours /> : null}
      <WatchWeb />
    </>
  );
}
