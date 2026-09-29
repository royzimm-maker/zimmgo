import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next.js's recommended rules (React, hooks, Core Web Vitals, TypeScript).
// Run with `npm run lint`; CI runs it on every push (.github/workflows/ci.yml).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler guidance rules (new in eslint-plugin-react-hooks 7).
      // They flag working code written before the compiler existed — e.g.
      // setState in an effect that reads localStorage on mount. Kept visible
      // as warnings to address deliberately, not as blocking errors.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "coverage/**"]),
]);
