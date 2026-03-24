#import <React/RCTBridgeModule.h>
#import <AVKit/AVKit.h>

@interface AirPlayModule : NSObject <RCTBridgeModule>
@property (nonatomic, strong) AVRoutePickerView *routePicker;
@end

@implementation AirPlayModule

RCT_EXPORT_MODULE(AirPlayModule)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(showPicker)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (!self.routePicker) {
      self.routePicker = [[AVRoutePickerView alloc] init];
      self.routePicker.prioritizesVideoDevices = YES;

      UIWindow *keyWindow = nil;
      for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
        if ([scene isKindOfClass:[UIWindowScene class]]) {
          UIWindowScene *windowScene = (UIWindowScene *)scene;
          for (UIWindow *window in windowScene.windows) {
            if (window.isKeyWindow) {
              keyWindow = window;
              break;
            }
          }
        }
      }
      if (keyWindow) {
        self.routePicker.frame = CGRectZero;
        [keyWindow addSubview:self.routePicker];
      }
    }

    for (UIView *subview in self.routePicker.subviews) {
      if ([subview isKindOfClass:[UIButton class]]) {
        [(UIButton *)subview sendActionsForControlEvents:UIControlEventTouchUpInside];
        break;
      }
    }
  });
}

@end
