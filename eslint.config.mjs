// @ts-check Let TS check this config file

import zotero from "@zotero-plugin/eslint-config";

export default zotero({
  overrides: [
    {
      name: "aidea/generated-files",
      ignores: ["site/.astro/**"],
    },
    {
      files: ["**/*.ts"],
      rules: {
        // We disable this rule here because the template
        // contains some unused examples and variables
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
    {
      files: ["test/test-gemini-cloudcode.mjs"],
      languageOptions: {
        globals: {
          console: "readonly",
          fetch: "readonly",
          process: "readonly",
          setTimeout: "readonly",
          TextDecoder: "readonly",
        },
      },
    },
    {
      files: ["test/contextPersistence.test.ts"],
      rules: {
        // This legacy suite uses arrow callbacks but never Mocha's dynamic `this`.
        "mocha/no-mocha-arrows": "off",
      },
    },
    {
      files: [
        "test/contextPersistence.test.ts",
        "test/oauthCliCopilot.test.ts",
        "test/oauthModelSelection.test.ts",
        "test/xhrStreaming.test.ts",
      ],
      rules: {
        // These files intentionally group related behavior in top-level suites.
        "mocha/max-top-level-suites": "off",
      },
    },
  ],
});
