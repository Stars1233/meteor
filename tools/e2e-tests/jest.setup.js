// jest.setup.js
import chalk from 'chalk';

// Clear NODE_ENV so meteor commands don't inherit any value from the test runner environment
process.env.NODE_ENV = '';

// Set fixed ports for all tests. RSPACK_DEVSERVER_PORT defaults to 18080 to avoid
// colliding with dev servers that some skeletons (e.g. Angular CLI) bundle on :8080.
// Individual tests may override via the `devServerPort` option in testMeteorSkeleton /
// testMeteorBundler, which sets this env var per test run.
process.env.RSPACK_DEVSERVER_PORT = '18080';
process.env.RSDOCTOR_CLIENT_PORT = '8888';
process.env.RSDOCTOR_SERVER_PORT = '8889';

// Client-rendered frameworks (Angular, React, Vue, etc.) may take longer to
// hydrate on slow CI runners. Increase Playwright's default selector/action
// timeout so waitForSelector calls don't race the framework bootstrap.
if (process.env.CI) {
  beforeEach(async () => {
    if (typeof page !== 'undefined') {
      page.setDefaultTimeout(60000);
    }
  });
}

// This runs before each test
beforeEach(() => {
  const name = expect.getState().currentTestName;
  // e.g. a bright cyan arrow and test name
  console.log(chalk.cyan(`▶ ${name}`));
});
