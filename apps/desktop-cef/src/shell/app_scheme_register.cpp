// Déclaration du schéma tentacle:// — liée par le principal ET par les helpers
// (bibliothèque tentacle_renderer) : une déclaration qui différerait d'un processus à
// l'autre donnerait deux origines différentes à la même page.

#include "shell/app_scheme.h"

namespace tentacle::appscheme {

void registerScheme(CefRawPtr<CefSchemeRegistrar> registrar) {
  registrar->AddCustomScheme(kScheme, CEF_SCHEME_OPTION_STANDARD | CEF_SCHEME_OPTION_SECURE |
                                          CEF_SCHEME_OPTION_CORS_ENABLED |
                                          CEF_SCHEME_OPTION_FETCH_ENABLED);
}

}  // namespace tentacle::appscheme
