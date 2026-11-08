// macOS : l'implémentation système du moteur de mise à jour (réseau NSURLSession, fils GCD,
// paquet .app par update_bundle_mac.mm). Pas de Sparkle : voir docs/MISE-A-JOUR.md.
#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#include <unistd.h>

#include <ctime>

#include "platform/macos/update_bundle_mac.h"
#include "update/system.h"

using tentacle::update::Platform;

namespace {

bool isNetworkError(NSError* e) {
  if (![e.domain isEqualToString:NSURLErrorDomain]) return false;
  switch (e.code) {
    case NSURLErrorNotConnectedToInternet:
    case NSURLErrorNetworkConnectionLost:
    case NSURLErrorTimedOut:
    case NSURLErrorCannotFindHost:
    case NSURLErrorCannotConnectToHost:
    case NSURLErrorDNSLookupFailed:
    case NSURLErrorInternationalRoamingOff:
    case NSURLErrorDataNotAllowed: return true;
    default: return false;
  }
}

NSURLSession* ephemeralSession(id<NSURLSessionDelegate> delegate) {
  NSURLSessionConfiguration* c = NSURLSessionConfiguration.ephemeralSessionConfiguration;
  c.requestCachePolicy = NSURLRequestReloadIgnoringLocalCacheData;
  c.timeoutIntervalForRequest = 30;
  c.waitsForConnectivity = NO;  // hors ligne : échouer vite, le moteur réessaiera
  return [NSURLSession sessionWithConfiguration:c delegate:delegate delegateQueue:nil];
}

}  // namespace

// Un téléchargement : progression, fichier déplacé à destination, fin.
@interface TTUpdateDownload : NSObject <NSURLSessionDownloadDelegate> {
 @public
  std::string dest;
  Platform::Progress progress;
  Platform::DownloadDone done;
  std::function<void(std::function<void()>)> post;
  std::string moveError;
}
@end

@implementation TTUpdateDownload
- (void)URLSession:(NSURLSession*)session
                 downloadTask:(NSURLSessionDownloadTask*)task
                 didWriteData:(int64_t)bytes
            totalBytesWritten:(int64_t)written
    totalBytesExpectedToWrite:(int64_t)expected {
  auto p = progress;
  const uint64_t got = uint64_t(written), total = expected > 0 ? uint64_t(expected) : 0;
  post([p, got, total] { p(got, total); });
}
- (void)URLSession:(NSURLSession*)session
                 downloadTask:(NSURLSessionDownloadTask*)task
    didFinishDownloadingToURL:(NSURL*)location {
  // Le fichier temporaire disparaît au retour de cette méthode : on le déplace ici.
  const NSInteger status = [(NSHTTPURLResponse*)task.response statusCode];
  if (status != 200) {
    moveError = "http-" + std::to_string(long(status));
    return;
  }
  unlink(dest.c_str());
  if (rename(location.fileSystemRepresentation, dest.c_str()) != 0) moveError = "move";
}
- (void)URLSession:(NSURLSession*)session task:(NSURLSessionTask*)task didCompleteWithError:(NSError*)error {
  std::string err = error ? std::string(error.localizedDescription.UTF8String) : moveError;
  const bool network = error && isNetworkError(error);
  auto d = done;
  post([d, err, network] { d(err, network); });
  [session finishTasksAndInvalidate];
}
@end

namespace tentacle::update {
namespace {

class MacPlatform : public Platform {
 public:
  explicit MacPlatform(SystemHooks h) : h_(std::move(h)) {
    [NSFileManager.defaultManager createDirectoryAtPath:[NSString stringWithUTF8String:h_.stateDir.c_str()]
                            withIntermediateDirectories:YES
                                             attributes:@{NSFilePosixPermissions : @0700}
                                                  error:nil];
    NSArray<NSString*>* argv = NSProcessInfo.processInfo.arguments;
    for (NSUInteger i = 1; i < argv.count; ++i)
      if (![argv[i] hasPrefix:@"-psn_"]) args_.emplace_back(argv[i].UTF8String);
  }

  std::optional<Version> currentVersion() override { return Version::parse(mac::bundleVersion()); }
  std::string platformKey() override {
#if defined(__aarch64__)
    return "macos-arm64";
#else
    return "macos-x86_64";
#endif
  }
  std::string stateDir() override { return h_.stateDir; }
  int64_t now() override { return int64_t(std::time(nullptr)); }
  bool canSelfUpdate(std::string* why) override { return mac::canReplace(mac::bundlePath(), why); }

  void fetch(const std::string& url, size_t maxBytes, FetchDone done) override {
    static NSURLSession* session = ephemeralSession(nil);
    NSURL* u = [NSURL URLWithString:[NSString stringWithUTF8String:url.c_str()]];
    if (!u) return done(std::nullopt, "bad-url");
    auto post = h_.post;
    NSURLSessionDataTask* t =
        [session dataTaskWithURL:u
               completionHandler:^(NSData* data, NSURLResponse* response, NSError* error) {
                 std::optional<std::string> body;
                 std::string err;
                 const NSInteger status = [(NSHTTPURLResponse*)response statusCode];
                 if (error) err = error.localizedDescription.UTF8String;
                 else if (status != 200) err = "http-" + std::to_string(long(status));
                 else if (data.length > maxBytes) err = "too-large";
                 else body = std::string(static_cast<const char*>(data.bytes), data.length);
                 post([done, body, err] { done(body, err); });
               }];
    [t resume];
  }

  void download(const std::string& url, const std::string& dest, Progress progress, DownloadDone done) override {
    NSURL* u = [NSURL URLWithString:[NSString stringWithUTF8String:url.c_str()]];
    if (!u) return done("bad-url", false);
    TTUpdateDownload* d = [TTUpdateDownload new];
    d->dest = dest;
    d->progress = std::move(progress);
    d->done = std::move(done);
    d->post = h_.post;
    task_ = [ephemeralSession(d) downloadTaskWithURL:u];
    [task_ resume];
  }
  void cancelDownload() override {
    [task_ cancel];
    task_ = nil;
  }

  void background(std::function<void()> work, std::function<void()> then) override {
    auto post = h_.post;
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
      work();
      post(then);
    });
  }
  void schedule(int64_t delayMs, std::function<void()> fn) override { h_.postDelayed(delayMs, std::move(fn)); }

  std::string stage(const std::string& archive, const Manifest& m, std::string* staged) override {
    return mac::stageArchive(archive, m, staged);
  }
  void discardStaged(const std::string&) override { mac::removeTree(mac::stagingRoot(mac::bundlePath())); }
  std::string apply(const std::string& staged, const Version& v, bool relaunch) override {
    std::vector<std::string> a{"apply",       "--pid",     std::to_string(getpid()), "--app",
                               mac::bundlePath(), "--staged", staged,                    "--state-dir",
                               h_.stateDir,   "--version", v.str()};
    if (relaunch) appendRelaunch(a);
    return mac::spawnHelper(h_.stateDir, a);
  }
  std::string rollback(const Probation& p) override {
    std::vector<std::string> a{"rollback",    "--pid",      std::to_string(getpid()),
                               "--app",       p.appPath.empty() ? mac::bundlePath() : p.appPath,
                               "--previous",  p.previousPath, "--state-dir", h_.stateDir, "--version", p.version};
    appendRelaunch(a);
    // L'assistant de l'ANCIENNE copie : celui de la version fautive l'est peut-être aussi.
    return mac::spawnHelper(h_.stateDir, a, p.previousPath);
  }
  void removeTree(const std::string& path) override { mac::removeTree(path); }
  void quitApp() override { h_.quit(); }

 private:
  void appendRelaunch(std::vector<std::string>& a) {
    a.push_back("--relaunch");
    a.push_back("--");
    a.insert(a.end(), args_.begin(), args_.end());
  }

  SystemHooks h_;
  std::vector<std::string> args_;
  NSURLSessionDownloadTask* task_ = nil;
};

}  // namespace

std::unique_ptr<Platform> createSystemPlatform(SystemHooks hooks) {
  return std::make_unique<MacPlatform>(std::move(hooks));
}

void openExternalUrl(const std::string& url) {
  NSURL* u = [NSURL URLWithString:[NSString stringWithUTF8String:url.c_str()]];
  if (u) [NSWorkspace.sharedWorkspace openURL:u];
}

}  // namespace tentacle::update
