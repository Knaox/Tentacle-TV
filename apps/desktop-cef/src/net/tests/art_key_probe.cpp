// Sonde des clés du cache des pochettes : une adresse par ligne sur l'entrée, rend
// « clé<TAB>fichier » (ou « -<TAB>- » pour une adresse refusée). Elle a servi à prouver la
// parité avec l'ancien bureau Electron (outil retiré avec lui, 1.50.0).
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
