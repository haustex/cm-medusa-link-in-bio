module.exports = {
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  // ESM-only packages (isbot): Node 22 can require() them, Jest's runtime cannot, so they are
  // compiled like our own files.
  transformIgnorePatterns: ["/node_modules/(?!(isbot)/)"],
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["<rootDir>/.medusa/"],
  testMatch: ["<rootDir>/src/**/__tests__/**/*.unit.spec.[jt]s"],
}
