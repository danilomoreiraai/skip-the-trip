export default {
  mutate: ["src/domain/**/*.ts", "src/services/**/*.ts", "!src/**/*.test.ts"],
  testRunner: "vitest",
  reporters: ["clear-text", "progress"],
  coverageAnalysis: "off",
  thresholds: { high: 90, low: 75, break: 70 },
  timeoutMS: 15000,
};
