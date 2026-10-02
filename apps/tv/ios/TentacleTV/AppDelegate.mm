#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTRootView.h>
#import "TentacleTV-Swift.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Rend le disque qu'une lecture interrompue a laissé dans tmp/ (PrismCore).
  [PrismLaunchSweep start];

  self.moduleName = @"TentacleTV";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

// L'écran de lancement reste à l'écran jusqu'au premier rendu de React, puis
// s'efface en fondu (0,25 s) sur le démarrage (`BootView`), qui en reprend la
// mascotte au même endroit. Sans lui, la vue racine restait NOIRE le temps de
// charger le JS : un trou entre le lancement et l'app.
- (void)customizeRootView:(RCTRootView *)rootView
{
  [super customizeRootView:rootView];
  UIStoryboard *launch = [UIStoryboard storyboardWithName:@"LaunchScreen" bundle:nil];
  UIView *loadingView = [launch instantiateInitialViewController].view;
  loadingView.frame = rootView.bounds;
  loadingView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  rootView.loadingView = loadingView;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
