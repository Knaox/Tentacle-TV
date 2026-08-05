import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/**
 * Configuration ESLint du monorepo — une seule, à la racine.
 *
 * Chaque paquet appelle `eslint src/` ; ESLint remonte jusqu'ici pour trouver
 * ses règles. Inutile d'en poser une par paquet : les règles qui comptent sont
 * les mêmes partout, et neuf copies divergeraient au premier ajout.
 *
 * Choix de périmètre : PAS d'analyse typée (`recommendedTypeChecked`). Ce que
 * les types savent dire, `tsc --noEmit` le dit déjà à chaque vérification, en
 * quelques secondes ; l'activer ici demanderait de charger le projet
 * TypeScript pour chaque paquet et rendrait le lint trop lent pour être lancé
 * souvent. Un garde-fou qu'on n'exécute pas ne garde rien.
 *
 * Ce que ce lint attrape et que le compilateur laisse passer :
 *  • les hooks React appelés conditionnellement, et les dépendances d'effet
 *    oubliées — la première cause de bugs de rendu de ce dépôt ;
 *  • le code mort (variables, imports, paramètres inutilisés) ;
 *  • les `case` qui débordent sur le suivant, les `==` accidentels.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.expo/**",
      "**/android/**",
      "**/ios/**",
      "**/src-tauri/**",
      "**/coverage/**",
      "apps/backend/data/**",
      "apps/desktop-electron/out/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...globals.es2022 },
    },
    rules: {
      // `_` en préfixe = « je sais, et c'est voulu ». Sans cette échappatoire,
      // la règle devient du bruit et finit désactivée partout.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // `any` est un aveu, pas une faute : le signaler suffit, l'interdire
      // ferait échouer la vérification sur du code qui marche.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }],
      eqeqeq: ["error", "smart"],
      "no-fallthrough": "error",
      // En avertissement, et c'est délibéré : le dépôt écrit `let x = null`
      // avant un `try`, y compris quand le `catch` sort de la fonction. La
      // règle a raison sur la lettre — la valeur n'est jamais lue — mais cette
      // initialisation est une garde qui survit au prochain remaniement du
      // bloc. La signaler suffit ; l'imposer ferait retoucher du code correct.
      "no-useless-assignment": "warn",
    },
  },

  // Interfaces React : c'est là que se jouent les erreurs de rendu.
  {
    files: ["apps/web/**/*.{ts,tsx}", "apps/mobile/**/*.{ts,tsx}", "apps/tv/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}", "packages/api-client/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      // En avertissement : ce dépôt contient des dépendances volontairement
      // omises, chacune justifiée en commentaire. Les passer en erreur
      // obligerait à mentir à la règle plutôt qu'à l'écouter.
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // React Native charge des modules à la demande — greffons optionnels,
  // ressources — et `require()` y est la seule façon de le faire. Ce n'est pas
  // une survivance de CommonJS, c'est le mécanisme de la plateforme.
  {
    files: ["apps/mobile/**/*.{ts,tsx}", "apps/tv/**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  // Gabarits qui portent du HTML dans une chaîne JavaScript : `<\/script>` y est
  // OBLIGATOIRE. Sans l'échappement, l'analyseur du document hôte referme la
  // balise au milieu de la chaîne et la page casse. La règle croit à une
  // maladresse ; c'est exactement l'inverse.
  {
    files: ["**/pluginHtmlTemplate.ts", "**/buildPluginHtml.ts"],
    rules: { "no-useless-escape": "off" },
  },

  // Les tests ont le droit aux acrobaties que le code de production n'a pas.
  {
    files: ["**/*.test.{ts,tsx}", "**/test/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);
