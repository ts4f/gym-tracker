import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

const TS_FILES = ["**/*.ts", "**/*.tsx"];

// The recommended preset applies obsidianmd rules — some type-aware — to every
// file, which crashes on JSON files where no TS program info exists. Scope the
// unscoped obsidianmd rule configs to TS files; JSON-specific configs (the
// package.json manifest checks) declare their own `files` and stay untouched.
const scopedRecommended = obsidianmd.configs.recommended.map((cfg) =>
  cfg.files === undefined &&
    cfg.rules !== undefined &&
    Object.keys(cfg.rules).some((name) => name.startsWith("obsidianmd/"))
    ? { ...cfg, files: TS_FILES }
    : cfg,
);

export default tseslint.config(
  globalIgnores([
    "node_modules",
    "dist",
    "esbuild.config.mjs",
    "eslint.config.js",
    // Build tooling, not plugin code: the preset assigns no TS parser to .mts,
    // so type-aware rules would crash on it.
    "eslint.config.mts",
    "version-bump.mjs",
    "versions.json",
    "main.js",
  ]),
  ...scopedRecommended,
  {
    files: TS_FILES,
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["vitest.config.ts"]
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
