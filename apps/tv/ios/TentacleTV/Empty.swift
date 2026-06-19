// Fichier Swift volontairement vide.
//
// Sa seule présence dans le target force Xcode à lier les bibliothèques de
// compatibilité Swift sur tvOS. Sans ça, le link échoue avec :
//   Undefined symbol: __swift_FORCE_LOAD_$_swiftCompatibility56
// (des pods comme RNScreens/Reanimated embarquent du Swift, mais l'app tvOS est
//  en Objective-C++ — AppDelegate.mm — donc le runtime Swift n'était pas lié.
//  L'app iOS, elle, a un AppDelegate.swift qui joue déjà ce rôle.)
import Foundation
