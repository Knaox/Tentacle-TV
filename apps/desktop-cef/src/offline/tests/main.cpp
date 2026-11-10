#include <atomic>
#include <chrono>
#include <fstream>
#include <sstream>

#include "tests/check.h"

namespace offline_tests {

std::vector<Case>& cases() {
  static std::vector<Case> list;
  return list;
}

int& failures() {
  static int count = 0;
  return count;
}

TempDir::TempDir() {
  static std::atomic<int> counter{0};
  const auto stamp = std::chrono::steady_clock::now().time_since_epoch().count();
  path = std::filesystem::temp_directory_path() /
         ("tentacle-offline-" + std::to_string(stamp) + "-" + std::to_string(counter++));
  std::filesystem::create_directories(path);
}

TempDir::~TempDir() {
  std::error_code ec;
  std::filesystem::remove_all(path, ec);
}

std::string repoFile(const std::string& relative) {
  std::ifstream in(std::filesystem::path(TENTACLE_REPO_ROOT) / relative, std::ios::binary);
  std::stringstream buffer;
  buffer << in.rdbuf();
  return buffer.str();
}

}  // namespace offline_tests

int main(int argc, char** argv) {
  const std::string filter = argc > 1 ? argv[1] : "";
  int ran = 0;
  for (const auto& c : offline_tests::cases()) {
    if (!filter.empty() && std::string(c.name).find(filter) == std::string::npos) continue;
    const int before = offline_tests::failures();
    try {
      c.body();
    } catch (const std::exception& e) {
      std::fprintf(stderr, "ÉCHEC %s : exception %s\n", c.name, e.what());
      offline_tests::failures()++;
    }
    ++ran;
    if (offline_tests::failures() != before) std::fprintf(stderr, "  ↳ dans %s\n", c.name);
  }
  std::fprintf(stderr, "%d cas, %d échec(s)\n", ran, offline_tests::failures());
  return offline_tests::failures() == 0 ? 0 : 1;
}
