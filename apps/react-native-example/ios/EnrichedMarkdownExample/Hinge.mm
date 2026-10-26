#import "Hinge.h"

#import <UIKit/UIKit.h>

// Reports the iPhone Duo's hinge through a UIHingeInteraction on the key
// window; elsewhere a single update says there is no hinge.
@implementation Hinge {
  id<UIInteraction> _interaction;
}

+ (NSString *)moduleName
{
  return @"Hinge";
}

- (void)start
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self detach];
    UIWindow *window = [self keyWindow];
    if (@available(iOS 27.1, *)) {
      if (window) {
        __weak Hinge *weakSelf = self;
        UIHingeInteraction *interaction =
            [[UIHingeInteraction alloc] initWithUpdateHandler:^(UIHingeInteraction *_, UIHingeInteractionUpdate *update) {
              [weakSelf emit:update.hinge];
            }];
        [window addInteraction:interaction];
        self->_interaction = interaction;
        return;
      }
    }
    [self emitOnChange:@{@"available" : @NO, @"angle" : @0, @"status" : @0}];
  });
}

- (void)stop
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self detach];
  });
}

- (void)emit:(UIHinge *)hinge API_AVAILABLE(ios(27.1))
{
  [self emitOnChange:@{
    @"available" : @(hinge != nil),
    @"angle" : @(hinge ? hinge.angle : 0),
    @"status" : @(hinge ? hinge.status : 0),
  }];
}

- (void)detach
{
  if (_interaction) {
    [_interaction.view removeInteraction:_interaction];
    _interaction = nil;
  }
}

- (UIWindow *)keyWindow
{
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:UIWindowScene.class]) {
      continue;
    }
    for (UIWindow *window in ((UIWindowScene *)scene).windows) {
      if (window.isKeyWindow) {
        return window;
      }
    }
  }
  return nil;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHingeSpecJSI>(params);
}

@end
