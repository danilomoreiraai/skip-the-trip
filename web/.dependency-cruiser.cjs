module.exports = {
  forbidden: [
    {
      name: "domain-is-independent",
      comment: "Domain modules may only depend on the domain and external validation libraries.",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/(components|pages|services|lib)" },
    },
    {
      name: "services-do-not-render",
      comment: "Services implement data access and must not depend on React UI modules.",
      severity: "error",
      from: { path: "^src/services" },
      to: { path: "^src/(components|pages)" },
    },
    {
      name: "shared-lib-does-not-reach-up",
      comment: "Shared libraries stay reusable and cannot import feature or UI modules.",
      severity: "error",
      from: { path: "^src/lib" },
      to: { path: "^src/(components|pages|services)" },
    },
    {
      name: "no-circular-dependencies",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.app.json" },
    enhancedResolveOptions: { exportsFields: ["exports"] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
