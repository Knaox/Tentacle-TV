#pragma once
// L'état HDR de l'écran, par OS (implémentations : src/platform/<os>/display_hdr_<os>.*) — le
// vocabulaire commun de `video/displayHdr.ts` d'Electron, pour que la règle (src/display) n'ait
// pas à choisir son camp.
//
// **Windows** a un interrupteur : l'écran est en HDR ou ne l'est pas, pour TOUT le bureau. On
// le bascule à l'entrée d'un film HDR (si la page l'autorise) et on le rend en sortant.
// **macOS** n'en a pas : l'EDR est accordé fenêtre par fenêtre, rien à basculer ni à rendre.
// **Linux** (Wayland) non plus ; X11 n'a rien. Fil principal seulement.

namespace tentacle::platform {

struct DisplayHdrProbe {
  // Un écran sait passer en HDR : la préférence de bascule a un sens (Windows seulement).
  bool supported = false;
  // Windows : un écran est en HDR. macOS : la plage étendue est accordée EN CE MOMENT à
  // l'écran de la fenêtre (headroom > 1), ce qui distingue demander d'obtenir.
  bool active = false;
  // macOS : l'écran SAIT faire de la plage étendue (diagnostic, jamais la préférence).
  bool edrCapable = false;
};

DisplayHdrProbe probeDisplayHdr(void* nativeWindow);

// L'OS a un interrupteur HDR à négocier avec la lecture (Windows) : sinon, la session HDR
// n'agit pas (et ne rabaisse jamais `target-colorspace-hint`, posé une fois sur macOS).
bool displayHdrNegotiated();
// Bascule en HDR les écrans qui le savent, en retenant leur état d'origine à la PREMIÈRE
// bascule ; retentée à chaque appel. Vrai si au moins un écran est en HDR ensuite.
bool enableDisplayHdr();
// Rend les écrans basculés à leur état d'origine (idempotent).
void restoreDisplayHdr();
// Avons-nous basculé un écran nous-mêmes (et devons-nous le rendre) ?
bool displayHdrToggled();

}  // namespace tentacle::platform
