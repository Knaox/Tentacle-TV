//
//  TentacleGlassView.m
//  TentacleTV (tvOS / Apple TV)
//
//  Le verre NATIF de la refonte TV : un `UIVisualEffectView` porteur d'un
//  `UIGlassEffect` (tvOS 26). `GlassSurface` (apps/tv/src/redesign/glass) le
//  monte comme couche de FOND, sous ses enfants React : la vue n'a jamais
//  d'enfant, elle remplace le voile, le reflet et le liseré simulés.
//
//  Ancienne architecture RN (`RCTNewArchEnabled` faux dans l'Info.plist) : un
//  `RCTViewManager` classique. Le JS lit la constante `supported` AVANT de
//  monter la vue — fausse avant tvOS 26, il garde la simulation, et la vue
//  n'est jamais créée.
//
//  L'en-tête de `UIVisualEffectView` met en garde contre une opacité < 1 et un
//  masque sur un parent. L'opacité est éprouvée au banc (scène `verre/fondu`,
//  tvOS 26.2) : sous un parent à 0,75 ou 0,5, le verre garde son flou et se
//  mélange au fond — les fondus des vues passent. Le masque ne l'est pas :
//  `GlassSurface` n'en pose aucun.
//

#import <React/RCTViewManager.h>
#import <UIKit/UIKit.h>

/// Vrai quand le système sait rendre le verre : tvOS 26, et la classe qui
/// répond (les bêtas de 26 plantaient à l'initialiseur — expo/expo#40911).
static BOOL TentacleGlassSupported(void)
{
  if (@available(tvOS 26.0, *)) {
    Class glass = NSClassFromString(@"UIGlassEffect");
    return glass != nil && [glass respondsToSelector:@selector(effectWithStyle:)];
  }
  return NO;
}

@interface TentacleGlassView : UIView

/// Rayon des coins, en points (celui de `GlassSurface`).
@property (nonatomic, assign) CGFloat radius;
/// `regular` · `strong` · `clear` — les densités de `GlassSurface`.
@property (nonatomic, copy) NSString *tone;

@end

@implementation TentacleGlassView {
  UIVisualEffectView *_effectView;
  // Le verre posé avant la première mise en page ne s'affiche pas toujours
  // (expo/expo#41024) : on attend des dimensions réelles.
  BOOL _laidOut;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    _tone = @"regular";
    // Une couche de fond : ni focalisable, ni touchable, ni lue par VoiceOver.
    self.userInteractionEnabled = NO;
    self.accessibilityElementsHidden = YES;
    _effectView = [[UIVisualEffectView alloc] initWithEffect:nil];
    _effectView.frame = self.bounds;
    _effectView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    _effectView.userInteractionEnabled = NO;
    [self addSubview:_effectView];
  }
  return self;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  if (!_laidOut && !CGRectIsEmpty(self.bounds)) {
    _laidOut = YES;
    [self applyEffect];
  }
}

- (void)setRadius:(CGFloat)radius
{
  _radius = radius;
  [self applyCorners];
}

- (void)setTone:(NSString *)tone
{
  if ([tone isEqualToString:_tone]) {
    return;
  }
  _tone = [tone copy];
  [self applyEffect];
}

- (void)applyEffect
{
  if (!_laidOut || !TentacleGlassSupported()) {
    return;
  }
  if (@available(tvOS 26.0, *)) {
    BOOL clear = [_tone isEqualToString:@"clear"];
    UIGlassEffect *effect = [UIGlassEffect effectWithStyle:clear ? UIGlassEffectStyleClear : UIGlassEffectStyleRegular];
    // `strong` : les feuilles et les menus qu'on lit longtemps — le verre
    // régulier, assombri, pour que le texte blanc tienne sur toute image.
    effect.tintColor = [_tone isEqualToString:@"strong"] ? [UIColor colorWithWhite:0 alpha:0.3] : nil;
    // Réaffecter l'effet : modifier celui qui est posé ne change rien.
    _effectView.effect = effect;
    [self applyCorners];
  }
}

- (void)applyCorners
{
  if (@available(tvOS 26.0, *)) {
    _effectView.cornerConfiguration =
        [UICornerConfiguration configurationWithUniformRadius:[UICornerRadius fixedRadius:_radius]];
  }
}

@end

@interface TentacleGlassViewManager : RCTViewManager
@end

@implementation TentacleGlassViewManager

RCT_EXPORT_MODULE()

// La constante ne lit que la version du système : aucun besoin du thread
// principal à l'initialisation.
+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (UIView *)view
{
  return [TentacleGlassView new];
}

- (NSDictionary *)constantsToExport
{
  return @{@"supported" : @(TentacleGlassSupported())};
}

RCT_EXPORT_VIEW_PROPERTY(radius, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(tone, NSString)

@end
