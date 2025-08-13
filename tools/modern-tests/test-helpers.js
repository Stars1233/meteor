/**
 * This file contains helper functions for testing Meteor applications.
 * It provides reusable test patterns for both the test apps.
 */

import {
  killProcessByPort,
  setupMeteorApp,
  runMeteorApp,
  cleanupTempDir,
  killMeteorProcess,
  runMeteorCommand,
  wait,
  appendFileContent,
  waitForMeteorOutput,
  waitForPlaywrightConsole,
  runMeteorTests,
  buildMeteorApp
} from "./helpers";
import { assertMeteorReactApp, assertRspackScriptTag, assertFileExist } from './assertions';
import fs from 'fs-extra';
import path from 'path';
import execa from 'execa';

/**
 * Helper function to set up and run tests for the Meteor Bundler
 * @param {Object} options - Options for the test
 * @param {string} options.appName - Name of the app ('react' or 'typescript')
 * @param {number} options.port - Port to run the app on
 * @param {Function} options.customAssertions - Custom assertions to run after the app is started
 * @returns {Function} - Jest test function
 */
export function testMeteorBundler(options) {
  const { appName, port, customAssertions } = options;

  return () => {
    let meteorProcess;
    let tempDir;

    beforeAll(async () => {
      // Ensure any process on the port is killed
      await killProcessByPort(port);

      // Setup the Meteor app
      tempDir = (await setupMeteorApp(appName))?.tempDir;
    });

    afterAll(async () => {
      // Clean up the temporary directory
      await cleanupTempDir(tempDir);
    });

    test(`"meteor run" / should start the app`, async () => {
      // Run the Meteor app
      meteorProcess = (await runMeteorApp(tempDir, port))?.meteorProcess;

      // Assert that the Meteor app is running correctly
      await assertMeteorReactApp(port, { title: appName });

      // Run custom assertions if provided
      if (customAssertions) {
        await customAssertions({ tempDir, port, meteorProcess });
      }

      // Kill the meteor process
      await killMeteorProcess(meteorProcess);

      // Ensure any process on the port is killed
      await killProcessByPort(port);
    });
  };
}

/**
 * Helper function to set up and run tests for the Meteor+Rspack Bundler
 * @param {Object} options - Options for the test
 * @param {string} options.appName - Name of the app ('react', 'typescript', etc)
 * @param {number} options.port - Port to run the app on
 * @param {Object} options.filePaths - File paths for the app
 * @param {string} options.filePaths.client - Client file path (e.g., 'client/main.jsx')
 * @param {string} options.filePaths.server - Server file path (e.g., 'server/main.js')
 * @param {string} options.filePaths.test - Test file path (e.g., 'tests/main.js')
 * @param {Object} options.customMessages - Custom messages for console logs
 * @param {string} options.customMessages.devClient - Message for development client
 * @param {string} options.customMessages.devServer - Message for development server
 * @param {string} options.customMessages.prodClient - Message for production client
 * @param {string} options.customMessages.prodServer - Message for production server
 * @param {string} options.customMessages.test - Message for test
 * @param {Function} options.customAssertions - Custom assertions to run after each test
 * @returns {Function} - Jest test function
 */
export function testMeteorRspackBundler(options) {
  const { 
    appName, 
    port, 
    filePaths = { 
      client: 'client/main.jsx', 
      server: 'server/main.js',
      test: 'tests/main.js'
    },
    customMessages = {
      devClient: "Hello from dev client",
      devServer: "Hello from dev server",
      prodClient: "Hello from prod client",
      prodServer: "Hello from prod server",
      test: "Hello from test"
    },
    customAssertions,
    // Some existing tests may fail if this is not set
    verbose = true,
  } = options;

  return () => {
    let meteorProcess;
    let tempDir;

    beforeAll(async () => {
      // Ensure any process on the port is killed
      await killProcessByPort(port);
      await killProcessByPort('8080');

      // Setup the Meteor app
      tempDir = (await setupMeteorApp(appName))?.tempDir;

      // Add Rspack package
      await runMeteorCommand('add', ['rspack'], tempDir, { checkExitCode: true });

      // Set meteor.modern.verbose to true
      if (verbose) {
        await execa('npm', ['pkg', 'delete', 'meteor.modern'], { cwd: tempDir });
        await execa('npm', ['pkg', 'set', 'meteor.modern.verbose=true'], { cwd: tempDir });
      }

      // Run the Meteor app to install Rspack
      const result = await runMeteorApp(tempDir, port, {
        waitForOutput: "=> App running at:",
      });
      meteorProcess = result.meteorProcess;

      // Wait for a margin
      await wait(1000);

      // Assert that the config files exists
      await assertFileExist(tempDir, '.gitignore', { content: '_build' });
      await assertFileExist(tempDir, 'rspack.config.js', { content: '@meteorjs/rspack' });

      // Kill the meteor process
      await killMeteorProcess(meteorProcess);

      // Ensure any process on the port is killed
      await killProcessByPort(port);
      await killProcessByPort('8080');
    });

    afterAll(async () => {
      // Clean up the temporary directory
      await cleanupTempDir(tempDir);
    });

    test(`"meteor run" / should run and rebuild the app with Rspack`, async () => {
      // Run the Meteor app and wait for "restarted at" output
      const result = await runMeteorApp(tempDir, port, {
        waitForOutput: "=> App running at:",
      });
      meteorProcess = result.meteorProcess;

      // Wait for a margin
      await wait(500);

      // Assert that the app files exists
      await assertFileExist(tempDir, '_build/main-dev/client-entry.js');
      await assertFileExist(tempDir, '_build/main-dev/client-rspack.js');
      await assertFileExist(tempDir, '_build/main-dev/client-meteor.js');
      await assertFileExist(tempDir, '_build/main-dev/server-entry.js');
      await assertFileExist(tempDir, '_build/main-dev/server-rspack.js');
      await assertFileExist(tempDir, '_build/main-dev/server-meteor.js');

      // Assert that the Meteor app is running correctly
      await assertMeteorReactApp(port, { title: appName });

      // Assert that the app is using Rspack
      await assertRspackScriptTag(port, true);

      // Update the client code
      await appendFileContent(tempDir, filePaths.client, {
        content: `if (Meteor.isDevelopment) console.log("${customMessages.devClient}");`,
      });
      await waitForPlaywrightConsole(customMessages.devClient);

      // Update the server code
      await appendFileContent(tempDir, filePaths.server, {
        content: `if (Meteor.isDevelopment) console.log("${customMessages.devServer}");`,
      });
      await waitForMeteorOutput(
        result.outputLines,
        customMessages.devServer
      );

      if (verbose) {
        await waitForMeteorOutput(
          result.outputLines,
          /.*isDevelopment:.*true.*/
        );
        await waitForMeteorOutput(
          result.outputLines,
          /.*isRun:.*true.*/
        );
      }

      // Run custom assertions if provided
      if (customAssertions && customAssertions.afterRun) {
        await customAssertions.afterRun({ tempDir, port, meteorProcess, result });
      }

      // Wait for a margin
      await wait(500);

      // Kill the meteor process
      await killMeteorProcess(meteorProcess);

      // Ensure any process on the port is killed
      await killProcessByPort(port);
      await killProcessByPort('8080');
    });

    test(`"meteor run --production" / should run and rebuild the app with Rspack in production`, async () => {
      // Run the Meteor app and wait for "restarted at" output
      const result = await runMeteorApp(tempDir, port, {
        waitForOutput: "=> App running at:",
        commandOptions: ['--production'],
      });
      meteorProcess = result.meteorProcess;

      // Wait for a margin
      await wait(500);

      // Assert that the app files exists
      await assertFileExist(tempDir, '_build/main-prod/client-entry.js');
      await assertFileExist(tempDir, '_build/main-prod/client-rspack.js');
      await assertFileExist(tempDir, '_build/main-prod/client-meteor.js');
      await assertFileExist(tempDir, '_build/main-prod/server-entry.js');
      await assertFileExist(tempDir, '_build/main-prod/server-rspack.js');
      await assertFileExist(tempDir, '_build/main-prod/server-meteor.js');

      await assertFileExist(tempDir, filePaths.server);

      // Assert that the Meteor app is running correctly
      await assertMeteorReactApp(port, { title: appName });

      // Assert that the app is using Rspack
      await assertRspackScriptTag(port, false);

      // Update the client code
      await appendFileContent(tempDir, filePaths.client, {
        content: `if (Meteor.isProduction) console.log("${customMessages.prodClient}");`,
      });
      await waitForPlaywrightConsole(customMessages.prodClient);

      // Update the server code
      await appendFileContent(tempDir, filePaths.server, {
        content: `if (Meteor.isProduction) console.log("${customMessages.prodServer}");`,
      });
      await waitForMeteorOutput(
        result.outputLines,
        customMessages.prodServer
      );
      if (verbose) {
        await waitForMeteorOutput(
          result.outputLines,
          /.*isProduction:.*true.*/
        );
        await waitForMeteorOutput(
          result.outputLines,
          /.*isRun:.*true.*/
        );
      }

      // Run custom assertions if provided
      if (customAssertions && customAssertions.afterRunProduction) {
        await customAssertions.afterRunProduction({ tempDir, port, meteorProcess, result });
      }

      // Wait for a margin
      await wait(500);

      // Kill the meteor process
      await killMeteorProcess(meteorProcess);

      // Ensure any process on the port is killed
      await killProcessByPort(port);
      await killProcessByPort('8080');
    });

    test(`"meteor test" / should run tests with Rspack`, async () => {
      const result = await runMeteorTests(tempDir, port, {
        waitForOutput: "=> App running at:",
        commandOptions: [],
        checkTestResults: false,
      });
      meteorProcess = result.meteorProcess;

      // Wait for a margin
      await wait(500);

      // Assert that the app files exists
      await assertFileExist(tempDir, '_build/test/test-entry.js');
      await assertFileExist(tempDir, '_build/test/test-rspack.js');
      await assertFileExist(tempDir, '_build/test/test-meteor.js');

      // Update the test code
      await appendFileContent(tempDir, filePaths.test, {
        content: `console.log("${customMessages.test}");`,
      });
      await waitForMeteorOutput(
        result.outputLines,
        customMessages.test
      );
      if (verbose) {
        await waitForMeteorOutput(
          result.outputLines,
          /.*isDevelopment:.*true.*/
        );
        await waitForMeteorOutput(
          result.outputLines,
          /.*isTest:.*true.*/
        );
      }

      // Run custom assertions if provided
      if (customAssertions && customAssertions.afterTest) {
        await customAssertions.afterTest({ tempDir, port, meteorProcess, result });
      }

      // Kill the meteor process
      await killMeteorProcess(meteorProcess);

      // Ensure any process on the port is killed
      await killProcessByPort(port);
    });

    test(`"meteor test --once" / should run tests once with Rspack`, async () => {
      // Test the app with Rspack once
      const result = await runMeteorTests(tempDir, port, {
        waitForOutput: "=> App running at:",
        commandOptions: ['--once'],
        checkTestResults: true,
      });

      // Wait for a margin
      await wait(500);

      // Assert that the app files exists
      await assertFileExist(tempDir, '_build/test/test-entry.js');
      await assertFileExist(tempDir, '_build/test/test-rspack.js');
      await assertFileExist(tempDir, '_build/test/test-meteor.js');
      if (verbose) {
        await waitForMeteorOutput(
          result.outputLines,
          /.*isDevelopment:.*true.*/
        );
        await waitForMeteorOutput(
          result.outputLines,
          /.*isTest:.*true.*/
        );
      }

      // Run custom assertions if provided
      if (customAssertions && customAssertions.afterTestOnce) {
        await customAssertions.afterTestOnce({ tempDir, port, result });
      }

      // Ensure any process on the port is killed
      await killProcessByPort(port);
    });

    test(`"meteor build" / should build the app with Rspack`, async () => {
      // Build the app with Rspack
      const { buildOutputDir, processResult: result } = await buildMeteorApp(tempDir, {
        commandOptions: ['--directory'],
        captureOutput: true
      });

      // Wait for a margin
      await wait(500);

      if (verbose) {
        await waitForMeteorOutput(
          result.outputLines,
          /.*isProduction:.*true.*/
        );
        await waitForMeteorOutput(
          result.outputLines,
          /.*isBuild:.*true.*/
        );
      }

      try {
        // Assert that the build output directory exists
        const buildDirExists = await fs.pathExists(buildOutputDir);
        expect(buildDirExists).toBe(true);

        // Assert that the main.js file exists
        expect(await fs.pathExists(`${buildOutputDir}/bundle/main.js`)).toBe(true);

        // Assert that the server/package.json file exists
        expect(await fs.pathExists(`${buildOutputDir}/bundle/programs/server/package.json`)).toBe(true);
        expect(await fs.pathExists(`${buildOutputDir}/bundle/programs/server/program.json`)).toBe(true);

        // Assert that the [web.browser|web.browser.legacy]/program.json file exists
        expect(await fs.pathExists(`${buildOutputDir}/bundle/programs/web.browser/program.json`)).toBe(true);
        expect(await fs.pathExists(`${buildOutputDir}/bundle/programs/web.browser.legacy/program.json`)).toBe(true);

        // Run npm install in the server directory
        console.log('Running npm install in the server directory...');
        const serverDir = path.join(buildOutputDir, 'bundle', 'programs', 'server');
        const npmInstallResult = await execa('npm', ['install'], {
          cwd: serverDir,
          stdio: 'inherit',
          shell: true,
        });

        // Check if the npm install command was successful
        expect(npmInstallResult.exitCode).toBe(0);

        // Run custom assertions if provided
        if (customAssertions && customAssertions.afterBuild) {
          await customAssertions.afterBuild({ tempDir, buildOutputDir, result });
        }
      } finally {
        // Clean up the build output directory
        await cleanupTempDir(buildOutputDir);
      }
    });
  };
}
