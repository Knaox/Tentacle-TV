const { build } = require("esbuild");
const { mkdirSync } = require("fs");
const { resolve } = require("path");

const outDir = resolve(__dirname, "..", "data", "shared-deps");
mkdirSync(outDir, { recursive: true });

// Problem: monorepo has React 18 at root and React 19 in backend/node_modules.
// react-dom@19 at root has its own nested react@19 copy. We need ALL react
// imports (including react-dom's internal require('react')) to resolve to the
// SAME React 19 from backend/node_modules.
const backendNM = resolve(__dirname, "..", "node_modules");
const reactPath = resolve(backendNM, "react");

const dedupeReact = {
  name: "dedupe-react",
  setup(b) {
    // Force ALL bare "react" and "react/*" imports to the backend's copy,
    // regardless of which file is importing them (including react-dom internals).
    b.onResolve({ filter: /^react(\/.*)?$/ }, (args) => {
      // Skip if already resolving from our target to avoid infinite loop
      if (args.resolveDir.startsWith(reactPath)) return undefined;
      try {
        return {
          path: require.resolve(args.path, { paths: [backendNM] }),
        };
      } catch {
        return undefined;
      }
    });
  },
};

build({
  stdin: {
    contents: `
      import * as React from "react";
      import * as JSXRuntime from "react/jsx-runtime";
      import * as ReactDOMClient from "react-dom/client";
      import * as TQ from "@tanstack/react-query";
      import * as RI from "react-i18next";
      import i18next from "i18next";

      window.__SHARED_DEPS__ = { React, JSXRuntime, ReactDOMClient, TQ, RI, i18next };
    `,
    resolveDir: resolve(__dirname, ".."),
    loader: "js",
  },
  bundle: true,
  format: "iife",
  minify: true,
  outfile: resolve(outDir, "shared-deps.js"),
  target: "es2020",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  plugins: [dedupeReact],
}).then(async () => {
  console.log("shared-deps.js built →", resolve(outDir, "shared-deps.js"));

  // Download Tailwind CSS runtime for plugin iframes
  const tailwindOut = resolve(outDir, "tailwind.js");
  const { existsSync } = require("fs");
  if (!existsSync(tailwindOut)) {
    console.log("Downloading tailwind.js from CDN...");
    const res = await fetch("https://cdn.tailwindcss.com");
    if (!res.ok) throw new Error(`Tailwind download failed: ${res.status}`);
    require("fs").writeFileSync(tailwindOut, await res.text());
    console.log("tailwind.js downloaded →", tailwindOut);
  } else {
    console.log("tailwind.js already exists, skipping download");
  }
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
