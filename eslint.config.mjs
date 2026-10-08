import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
const config = tseslint.config(
  {
    ignores: [
      "out/**",
      ".next/**",
      "node_modules/**",
      "public/pdf.worker.min.mjs",
      "test-results/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
export default config;
