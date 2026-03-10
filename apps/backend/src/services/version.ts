import { readFileSync } from "fs";
import { join } from "path";

export const BACKEND_VERSION: string = (() => {
  try {
    return JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
