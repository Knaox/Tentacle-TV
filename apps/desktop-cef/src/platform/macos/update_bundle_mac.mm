// macOS : préparer, contrôler et échanger le paquet .app (voir update_bundle_mac.h).
#include "platform/macos/update_bundle_mac.h"

#import <Foundation/Foundation.h>
#import <Security/Security.h>
#include <copyfile.h>
#include <dirent.h>
#include <fcntl.h>
#include <mach-o/fat.h>
#include <mach-o/loader.h>
#include <removefile.h>
#include <spawn.h>
#include <stdio.h>
#include <sys/mount.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <unistd.h>

#include <algorithm>
#include <cstring>

extern char** environ;

namespace tentacle::update::mac {
namespace {

std::string parentOf(const std::string& p) { return p.substr(0, p.find_last_of('/')); }
std::string nameOf(const std::string& p) { return p.substr(p.find_last_of('/') + 1); }
NSString* ns(const std::string& s) { return [NSString stringWithUTF8String:s.c_str()]; }
std::string str(NSString* s) { return s ? std::string(s.UTF8String) : std::string(); }

int run(const std::vector<std::string>& argv) {
  std::vector<char*> args;
  for (auto& a : argv) args.push_back(const_cast<char*>(a.c_str()));
  args.push_back(nullptr);
  pid_t pid;
  if (posix_spawn(&pid, args[0], nullptr, nullptr, args.data(), environ) != 0) return -1;
  int status = 0;
  while (waitpid(pid, &status, 0) < 0 && errno == EINTR) {
  }
  return WIFEXITED(status) ? WEXITSTATUS(status) : -1;
}

// Info.plist lu À CHAQUE FOIS (NSBundle garde un cache par chemin : la deuxième copie
// préparée au même endroit se lirait avec le dictionnaire de la première).
NSDictionary* infoOf(const std::string& app) {
  return [NSDictionary dictionaryWithContentsOfFile:ns(app + "/Contents/Info.plist")];
}

// L'exécutable contient-il l'architecture de ce Mac (Mach-O simple ou universel) ?
bool hasOwnArchitecture(const std::string& exe) {
#if defined(__aarch64__)
  const cpu_type_t want = CPU_TYPE_ARM64;
#else
  const cpu_type_t want = CPU_TYPE_X86_64;
#endif
  FILE* f = fopen(exe.c_str(), "rb");
  if (!f) return false;
  uint32_t head[2] = {};
  bool found = false;
  if (fread(head, sizeof head, 1, f) == 1) {
    if (head[0] == MH_MAGIC_64) {
      found = cpu_type_t(head[1]) == want;
    } else if (head[0] == FAT_CIGAM || head[0] == FAT_MAGIC) {
      const uint32_t n = std::min<uint32_t>(OSSwapBigToHostInt32(head[1]), 16);
      for (uint32_t i = 0; i < n && !found; ++i) {
        fat_arch a;
        if (fread(&a, sizeof a, 1, f) != 1) break;
        found = cpu_type_t(OSSwapBigToHostInt32(uint32_t(a.cputype))) == want;
      }
    }
  }
  fclose(f);
  return found;
}

// L'équipe (Team ID) qui signe l'app en cours ; vide pour une signature ad hoc (dev).
std::string currentTeam() {
  SecCodeRef self = nullptr;
  SecStaticCodeRef code = nullptr;
  std::string team;
  if (SecCodeCopySelf(kSecCSDefaultFlags, &self) == errSecSuccess &&
      SecCodeCopyStaticCode(self, kSecCSDefaultFlags, &code) == errSecSuccess) {
    CFDictionaryRef info = nullptr;
    if (SecCodeCopySigningInformation(code, kSecCSSigningInformation, &info) == errSecSuccess && info) {
      NSDictionary* d = (__bridge NSDictionary*)info;
      team = str(d[(__bridge NSString*)kSecCodeInfoTeamIdentifier]);
      CFRelease(info);
    }
  }
  if (code) CFRelease(code);
  if (self) CFRelease(self);
  return team;
}

// Signature valide (tout le paquet, code imbriqué compris) et, si l'app en cours est signée
// par une équipe, la MÊME équipe — comme Sparkle. Une app ad hoc (banc) n'exige que la validité.
std::string checkSignature(const std::string& app) {
  SecStaticCodeRef code = nullptr;
  if (SecStaticCodeCreateWithPath((__bridge CFURLRef)[NSURL fileURLWithPath:ns(app)], kSecCSDefaultFlags, &code) !=
      errSecSuccess)
    return "signature:unreadable";
  SecRequirementRef req = nullptr;
  const std::string team = currentTeam();
  if (!team.empty()) {
    const std::string text = "anchor apple generic and certificate leaf[subject.OU] = \"" + team + "\"";
    SecRequirementCreateWithString((__bridge CFStringRef)ns(text), kSecCSDefaultFlags, &req);
  }
  const OSStatus st = SecStaticCodeCheckValidity(
      code, kSecCSCheckAllArchitectures | kSecCSCheckNestedCode | kSecCSStrictValidate, req);
  if (req) CFRelease(req);
  CFRelease(code);
  if (st == errSecSuccess) return {};
  return (team.empty() ? "signature:" : "signature-team:") + std::to_string(int(st));
}

}  // namespace

std::string bundlePath() { return str(NSBundle.mainBundle.bundlePath); }
std::string bundleIdentifier() { return str(NSBundle.mainBundle.bundleIdentifier); }
std::string bundleVersion() {
  return str([NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"]);
}
std::string stagingRoot(const std::string& app) { return parentOf(app) + "/." + nameOf(app) + ".update"; }
std::string previousPath(const std::string& app) { return parentOf(app) + "/." + nameOf(app) + ".previous"; }

std::string bundleIdOf(const std::string& app) { return str(infoOf(app)[@"CFBundleIdentifier"]); }

std::string executableOf(const std::string& app) {
  const std::string exe = str(infoOf(app)[@"CFBundleExecutable"]);
  return exe.empty() ? std::string() : app + "/Contents/MacOS/" + exe;
}

bool canReplace(const std::string& app, std::string* why) {
  auto no = [why](const char* reason) {
    if (why) *why = reason;
    return false;
  };
  if (app.size() < 5 || app.compare(app.size() - 4, 4, ".app") != 0) return no("not-a-bundle");
  // Gatekeeper a « transloqué » l'app (lancée depuis Téléchargements sans être déplacée).
  if (app.find("/AppTranslocation/") != std::string::npos) return no("translocated");
  struct statfs fs;
  if (statfs(app.c_str(), &fs) == 0 && (fs.f_flags & MNT_RDONLY)) return no("read-only-volume");
  if (access(parentOf(app).c_str(), W_OK) != 0 || access(app.c_str(), W_OK) != 0) return no("not-writable");
  if (access((app + "/Contents/MacOS/tentacle-update").c_str(), X_OK) != 0) return no("no-helper");
  return true;
}

std::string stageArchive(const std::string& archive, const Manifest& m, std::string* stagedApp) {
  const std::string app = bundlePath();
  const std::string root = stagingRoot(app);
  removeTree(root);
  if (mkdir(root.c_str(), 0700) != 0) return std::string("mkdir:") + std::strerror(errno);
  // bsdtar : xz, gzip ou zip, liens symboliques des frameworks gardés, « .. » refusé.
  if (run({"/usr/bin/tar", "-xf", archive, "-C", root}) != 0) return removeTree(root), "extract";
  std::string found;
  int count = 0;
  if (DIR* d = opendir(root.c_str())) {
    while (dirent* e = readdir(d)) {
      const std::string n = e->d_name;
      if (n == "." || n == "..") continue;
      count++;
      if (n.size() > 4 && n.compare(n.size() - 4, 4, ".app") == 0) found = root + "/" + n;
    }
    closedir(d);
  }
  if (found.empty() || count != 1) return removeTree(root), "layout";
  if (std::string err = verifyStaged(found, m.version.str(), bundleIdentifier()); !err.empty())
    return removeTree(root), err;
  *stagedApp = found;
  return {};
}

std::string verifyStaged(const std::string& staged, const std::string& version, const std::string& bundleId) {
  NSDictionary* info = infoOf(staged);
  if (!info) return "no-info";
  if (str(info[@"CFBundleIdentifier"]) != bundleId) return "bundle-id";
  if (str(info[@"CFBundleShortVersionString"]) != version) return "version";
  // Une version qui ne pourrait pas s'ouvrir sur CE Mac ne se pose pas (la pose à la fermeture
  // n'a personne pour la surveiller : elle échouerait avant tout code de l'app).
  if (NSString* min = info[@"LSMinimumSystemVersion"]) {
    NSArray<NSString*>* parts = [min componentsSeparatedByString:@"."];
    NSOperatingSystemVersion need{parts.count > 0 ? parts[0].integerValue : 0,
                                  parts.count > 1 ? parts[1].integerValue : 0,
                                  parts.count > 2 ? parts[2].integerValue : 0};
    if (![NSProcessInfo.processInfo isOperatingSystemAtLeastVersion:need]) return "macos-too-old";
  }
  const std::string exe = executableOf(staged);
  if (exe.empty() || !hasOwnArchitecture(exe)) return "architecture";
  return checkSignature(staged);
}

std::string spawnHelper(const std::string& stateDir, const std::vector<std::string>& args,
                        const std::string& sourceApp) {
  // Copié hors du paquet : l'assistant ne doit pas vivre dans ce qu'il remplace.
  const std::string src = (sourceApp.empty() ? bundlePath() : sourceApp) + "/Contents/MacOS/tentacle-update";
  const std::string exe = stateDir + "/tentacle-update";
  unlink(exe.c_str());
  if (copyfile(src.c_str(), exe.c_str(), nullptr, COPYFILE_ALL) != 0) return "helper-copy";
  chmod(exe.c_str(), 0755);
  const std::string log = stateDir + "/helper.log";

  posix_spawn_file_actions_t fa;
  posix_spawn_file_actions_init(&fa);
  posix_spawn_file_actions_addopen(&fa, 0, "/dev/null", O_RDONLY, 0);
  posix_spawn_file_actions_addopen(&fa, 1, log.c_str(), O_WRONLY | O_CREAT | O_APPEND, 0600);
  posix_spawn_file_actions_adddup2(&fa, 1, 2);
  posix_spawnattr_t attr;
  posix_spawnattr_init(&attr);
  // Sa propre session (il survit à l'app) et aucun descripteur hérité de CEF.
  posix_spawnattr_setflags(&attr, POSIX_SPAWN_SETSID | POSIX_SPAWN_CLOEXEC_DEFAULT);
  std::vector<char*> argv{const_cast<char*>(exe.c_str())};
  for (auto& a : args) argv.push_back(const_cast<char*>(a.c_str()));
  argv.push_back(nullptr);
  pid_t pid;
  const int rc = posix_spawn(&pid, exe.c_str(), &fa, &attr, argv.data(), environ);
  posix_spawn_file_actions_destroy(&fa);
  posix_spawnattr_destroy(&attr);
  return rc == 0 ? std::string() : std::string("helper-spawn:") + std::strerror(rc);
}

std::string swapIn(const std::string& app, const std::string& staged, const std::string& previous, bool* atomic) {
  removeTree(previous);
  if (atomic) *atomic = false;
  if (renamex_np(staged.c_str(), app.c_str(), RENAME_SWAP) == 0) {
    if (atomic) *atomic = true;
    // `staged` porte maintenant l'ancienne copie.
    if (rename(staged.c_str(), previous.c_str()) != 0) return std::string("keep-previous:") + std::strerror(errno);
    return {};
  }
  // Pas d'échange atomique (HFS+, SMB…) : deux rename, l'ancienne copie remise si le second échoue.
  if (rename(app.c_str(), previous.c_str()) != 0) return std::string("move-old:") + std::strerror(errno);
  if (rename(staged.c_str(), app.c_str()) != 0) {
    const int e = errno;
    rename(previous.c_str(), app.c_str());
    return std::string("move-new:") + std::strerror(e);
  }
  return {};
}

std::string swapBack(const std::string& app, const std::string& previous) {
  if (renamex_np(previous.c_str(), app.c_str(), RENAME_SWAP) == 0) {
    removeTree(previous);  // porte maintenant la copie fautive
    return {};
  }
  const std::string failed = previousPath(app) + ".failed";
  removeTree(failed);
  if (rename(app.c_str(), failed.c_str()) != 0) return std::string("move-failed:") + std::strerror(errno);
  if (rename(previous.c_str(), app.c_str()) != 0) {
    const int e = errno;
    rename(failed.c_str(), app.c_str());
    return std::string("restore:") + std::strerror(e);
  }
  removeTree(failed);
  return {};
}

void removeTree(const std::string& path) {
  if (path.empty() || path == "/") return;
  removefile_state_t s = removefile_state_alloc();
  removefile(path.c_str(), s, REMOVEFILE_RECURSIVE);
  removefile_state_free(s);
}

}  // namespace tentacle::update::mac
