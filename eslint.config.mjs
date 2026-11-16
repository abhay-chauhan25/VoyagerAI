import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Command-line scripts report progress on stdout by design.
    files: ["scripts/**/*.mjs"],
    rules: { "no-console": "off" },
  },
  {
    // The 3D scene is drawn by changing Three.js objects (materials, the camera, marker positions)
    // every frame, outside React's render. That is how a render loop works, and it is exactly what
    // this rule exists to forbid in ordinary components.
    files: ["src/components/boarding/plane/**/*.tsx"],
    rules: { "react-hooks/immutability": "off" },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "next-env.d.ts",
      "src/lib/supabase/database.types.ts",
    ],
  },
];

export default config;
