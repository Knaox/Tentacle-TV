# nav-golden — le banc de référence de la navigation Apple TV

Rejoue des scénarios de télécommande sur l'app réelle (simulateur tvOS, ou
Apple TV physique), sur des données figées, et compare chaque pas au relevé
pris sur le code d'origine. Une commande, depuis n'importe quel dossier de
travail :

```bash
node apps/tv/harness/nav-golden/nav-golden.mjs verify --slot <n> [domaine]
```

Mode d'emploi complet (écrire, enregistrer, vérifier, jeux de données,
limites) : [docs/tv-navigation/banc.md](../../../../docs/tv-navigation/banc.md).
