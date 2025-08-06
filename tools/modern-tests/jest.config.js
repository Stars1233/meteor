module.exports = {
  rootDir: __dirname,
  testMatch: ["**/*.test.js"],
  testEnvironment: "node",
  verbose: true,
  // Increase timeout for CLI operations
  testTimeout: 120_000,
  // Transform ES modules in node_modules
  transformIgnorePatterns: [
    "/node_modules/(?!(execa|wait-on|is-docker|is-stream|human-signals|merge-stream|npm-run-path|onetime|mimic-fn|strip-final-newline|path-key|shebug-command|shebug-regex)/)"
  ],
  // Use Babel to transform JavaScript files
  transform: {
    "^.+\\.js$": "babel-jest"
  },
};
