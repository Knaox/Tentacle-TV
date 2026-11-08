#pragma once
// CefApp des processus helpers. Seul le rendu (renderer) a un rôle : poser
// window.__shell et les scripts injectés AVANT tout script de la page, et relayer l'IPC.

#include "include/cef_app.h"

namespace tentacle {

CefRefPtr<CefApp> createHelperApp();

}  // namespace tentacle
