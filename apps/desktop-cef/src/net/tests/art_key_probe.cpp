// Sonde de parité (tools/art-key-xcheck.mjs) : une adresse par ligne sur l'entrée, rend
// « clé<TAB>fichier » (ou « -<TAB>- » pour une adresse refusée) — à comparer à Electron.
#include <iostream>
#include <string>

#include "net/art_policy.h"

int main() {
  std::string line;
  while (std::getline(std::cin, line)) {
    const auto k = tentacle::net::art::key(line);
    std::cout << (k ? *k : "-") << '\t' << (k ? tentacle::net::art::fileNameOf(*k) : "-") << '\n';
  }
  return 0;
}
