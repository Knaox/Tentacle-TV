#pragma once
// La fabrique de l'implémentation système (une par OS, dans src/platform/<os>/update_*).
// La colle (update_shell.cpp) lui passe ce qui vient du socle : le fil principal, la
// sortie de l'app, le dossier d'état.

#include <cstdint>
#include <functional>
#include <memory>
#include <string>

#include "update/platform.h"

namespace tentacle::update {

struct SystemHooks {
  std::function<void(std::function<void()>)> post;                  // vers le fil principal
  std::function<void(int64_t, std::function<void()>)> postDelayed;  // idem, différé (ms)
  std::function<void()> quit;                                       // quitter l'app proprement
  std::string stateDir;  // dossier privé de la mise à jour (créé au besoin)
  // Les arguments de la relance (ceux de ce lancement) : chaque OS les relit lui-même
  // (NSProcessInfo, /proc/self/cmdline, GetCommandLineW).
};

std::unique_ptr<Platform> createSystemPlatform(SystemHooks hooks);

// Ouvre une page dans le navigateur du système (lien des nouveautés).
void openExternalUrl(const std::string& url);

}  // namespace tentacle::update
