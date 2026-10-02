//
//  TentacleDesaturateView.m
//  TentacleTV (tvOS / Apple TV)
//
//  Ce qui est SOUS cette vue passe en niveaux de gris : l'affiche d'un titre
//  absent de la bibliothèque (`GreyscaleImage`, apps/tv/src/redesign/cards).
//  Une vue grise composée en « saturation » (`compositingFilter`,
//  `saturationBlendMode`) : le résultat garde la teinte et la luminosité de ce
//  qu'elle couvre, et prend la saturation du gris — nulle. Le serveur de rendu
//  compose sur le GPU : rien ne se dessine sur le processeur, ni au montage,
//  ni au focus (mesuré au banc : le même gris par un filtre SVG coûtait
//  50 à 75 ms du fil principal par affiche).
//
//  Ancienne architecture RN (`RCTNewArchEnabled` faux dans l'Info.plist) : un
//  `RCTViewManager` classique, sans propriété. Un binaire plus ancien n'a pas
//  la vue : le JS le voit (`getViewManagerConfig`) et garde son filtre SVG.
//

#import <React/RCTViewManager.h>
#import <UIKit/UIKit.h>

@interface TentacleDesaturateView : UIView
@end

@implementation TentacleDesaturateView

- (instancetype)initWithFrame:(CGRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    // Un calque qui ne fait que composer : ni appui, ni focus, ni accessibilité.
    self.userInteractionEnabled = NO;
    self.isAccessibilityElement = NO;
    self.backgroundColor = [UIColor grayColor];
    self.layer.compositingFilter = @"saturationBlendMode";
  }
  return self;
}

// Toujours ce gris : c'est lui qui porte la saturation nulle, quoi que les
// props de React posent.
- (void)setBackgroundColor:(UIColor *)backgroundColor
{
  [super setBackgroundColor:[UIColor grayColor]];
}

- (BOOL)canBecomeFocused
{
  return NO;
}

@end

@interface TentacleDesaturateViewManager : RCTViewManager
@end

@implementation TentacleDesaturateViewManager

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (UIView *)view
{
  return [TentacleDesaturateView new];
}

@end
