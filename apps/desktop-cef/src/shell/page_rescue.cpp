#include "shell/page_rescue.h"

#include <filesystem>
#include <fstream>
#include <sstream>

#include "shell/json.h"

namespace tentacle::rescue {
namespace {

namespace fs = std::filesystem;

const char* modeKey(Mode m) { return m == Mode::noGpu ? "sans-gpu" : "peinture-logicielle"; }

bool writeFile(const fs::path& path, const std::string& content) {
  std::error_code ec;
  fs::create_directories(path.parent_path(), ec);  // au premier lancement, Chromium ne l'a pas encore créé
  std::ofstream out(path, std::ios::trunc);
  out << content;
  return bool(out);
}

void writeRescue(const std::string& dir, Mode mode, const std::string& reason, int launches) {
  const Json j{{"mode", modeKey(mode)}, {"raison", reason}, {"lancements", launches}};
  writeFile(fs::path(dir) / kRescueFile, j.dump(2) + "\n");
}

}  // namespace

namespace {
Decision g_last;  // la décision de CE lancement (startupHandedOff)
Decision decide(const std::string& dir, bool forced);
}  // namespace

Decision atStartup(const std::string& dir, bool forced) {
  g_last = decide(dir, forced);
  return g_last;
}

const Decision& current() { return g_last; }

void startupHandedOff(const std::string& dir) {
  if (g_last.reason == "TENTACLE_NO_SHARED_TEXTURE") return;
  if (g_last.mode == Mode::accelerated) return pageShown(dir);
  writeRescue(dir, g_last.mode, g_last.reason, g_last.launchesLeft + 1);
}

namespace {
Decision decide(const std::string& dir, bool forced) {
  if (forced) return {Mode::softwarePaint, "TENTACLE_NO_SHARED_TEXTURE", 0};
  std::error_code ec;
  const fs::path rescue = fs::path(dir) / kRescueFile, witness = fs::path(dir) / kWitnessFile;
  if (fs::exists(rescue, ec)) {
    // Un secours en cours : ce lancement en consomme un. Illisible : il est soldé.
    Json j;
    {
      std::ifstream in(rescue);
      j = Json::parse(in, nullptr, false);
    }
    const int launches = j.is_object() ? j.value("lancements", 0) : 0;
    if (launches > 0) {
      const Mode mode = j.value("mode", std::string()) == modeKey(Mode::noGpu) ? Mode::noGpu : Mode::softwarePaint;
      const std::string reason = j.value("raison", std::string("secours d'affichage"));
      if (launches > 1) {
        writeRescue(dir, mode, reason, launches - 1);
      } else {
        fs::remove(rescue, ec);  // le dernier : le suivant retente la voie accélérée
      }
      fs::remove(witness, ec);
      return {mode, reason, launches - 1};
    }
    fs::remove(rescue, ec);
  }
  if (fs::exists(witness, ec)) {
    // Le lancement précédent n'a jamais montré la page (processus GPU en boucle, pilote, app
    // tuée avant sa première image) : on ne dépend plus de rien.
    const std::string reason = "le lancement précédent n'a jamais affiché la page";
    fs::remove(witness, ec);
    if (kRescueLaunches > 1) writeRescue(dir, Mode::noGpu, reason, kRescueLaunches - 1);
    return {Mode::noGpu, reason, kRescueLaunches - 1};
  }
  writeFile(witness, "1\n");
  return {};
}
}  // namespace

void pageShown(const std::string& dir) {
  std::error_code ec;
  fs::remove(fs::path(dir) / kWitnessFile, ec);
}

void acceleratedRefused(const std::string& dir, const std::string& reason) {
  std::error_code ec;
  fs::remove(fs::path(dir) / kWitnessFile, ec);
  writeRescue(dir, Mode::softwarePaint, reason, kRescueLaunches);
}

std::string describe(const Decision& d) {
  if (d.mode == Mode::accelerated) return {};
  std::ostringstream o;
  o << "[rendu] secours d'affichage : "
    << (d.mode == Mode::noGpu ? "page peinte en logiciel, Chromium sans GPU" : "page peinte en logiciel (OnPaint)")
    << " — " << d.reason;
  if (d.launchesLeft > 0) {
    o << " ; la voie accélérée sera retentée dans " << d.launchesLeft << " lancement" << (d.launchesLeft > 1 ? "s" : "");
  } else if (d.reason != "TENTACLE_NO_SHARED_TEXTURE") {
    o << " ; la voie accélérée sera retentée au prochain lancement";
  }
  return o.str();
}

bool ImportHealth::note(bool imported) {
  if (imported) {
    ++imported_;
    failuresInARow_ = 0;
    return false;
  }
  ++failuresInARow_;
  if (concluded_) return false;
  const int limit = imported_ == 0 ? kRefusalsAtStart : kRefusalsLater;
  if (failuresInARow_ < limit) return false;
  concluded_ = true;
  return true;
}

}  // namespace tentacle::rescue
