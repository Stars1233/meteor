import {
  killProcessByPort,
  setupMeteorApp,
  runMeteorApp,
  cleanupTempDir,
  killMeteorProcess,
  createMeteorApp,
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

describe('React App Bundling /', () => {
  describe('Meteor Creator /', () => {
    const PORT = 3100;

    beforeAll(async () => {
      // Ensure any process on the port is killed
      await killProcessByPort(PORT);
    });

    test('"meteor create" / should create a new Meteor react app', async () => {
      // Create a new Meteor app with --react example
      const result = await createMeteorApp('react', 'react');
      const newAppTempDir = result.tempDir;
      const newAppMeteorProcess = result.meteorProcess;

      // Wait for the process to complete
      await newAppMeteorProcess;

      // Check if the app directory exists
      const appDirExists = await fs.pathExists(newAppTempDir);
      expect(appDirExists).toBe(true);

      // Check if package.json exists and contains react
      const packageJsonPath = path.join(newAppTempDir, 'package.json');
      const packageJsonExists = await fs.pathExists(packageJsonPath);
      expect(packageJsonExists).toBe(true);

      const packageJson = await fs.readJson(packageJsonPath);
      expect(packageJson.dependencies).toHaveProperty('react');
      expect(packageJson.dependencies).toHaveProperty('react-dom');

      // Run the newly created app
      let runAppProcess = (await runMeteorApp(newAppTempDir, PORT))?.meteorProcess;

      // Assert that the Meteor React app is running correctly
      await assertMeteorReactApp(PORT);

      // Kill the meteor processes
      await killMeteorProcess(runAppProcess);
      if (newAppMeteorProcess) {
        await killMeteorProcess(newAppMeteorProcess);
      }

      // Ensure any process on the port is killed
      await killProcessByPort(PORT);

      // Clean up the temporary directory
      await cleanupTempDir(newAppTempDir);
    });
  });

  describe('Meteor Bundler /', () => {
    const PORT = 3101;
    let meteorProcess;
    let tempDir;

    beforeAll(async () => {
      // Ensure any process on the port is killed
      await killProcessByPort(PORT);

      // Setup the Meteor app
      tempDir = (await setupMeteorApp('react'))?.tempDir;
    });

    afterAll(async () => {
      // Clean up the temporary directory
      await cleanupTempDir(tempDir);
    });

    test(`"meteor run" / should start the app`, async () => {
      // Run the Meteor app
      meteorProcess = (await runMeteorApp(tempDir, PORT))?.meteorProcess;

      // Assert that the Meteor React app is running correctly
      await assertMeteorReactApp(PORT);

      // Kill the meteor process
      await killMeteorProcess(meteorProcess);

      // Ensure any process on the port is killed
      await killProcessByPort(PORT);
    });
  });

  describe('Meteor+Rspack Bundler /', () => {
    const PORT = 3102;
    let meteorProcess;
    let tempDir;

    beforeAll(async () => {
      // Ensure any process on the port is killed
      await killProcessByPort(PORT);
      await killProcessByPort('8080');

      // Setup the Meteor app
      tempDir = (await setupMeteorApp('react'))?.tempDir;

      // Add Rspack package
      await runMeteorCommand('add', ['rspack'], tempDir, { checkExitCode: true });

      // Run the Meteor app to install Rspack
      const result = await runMeteorApp(tempDir, PORT, {
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
      await killProcessByPort(PORT);
      await killProcessByPort('8080');
    });

    afterAll(async () => {
      // Clean up the temporary directory
      await cleanupTempDir(tempDir);
    });

    test(`"meteor run" / should run and rebuild the app with Rspack`, async () => {
      // Run the Meteor app and wait for "restarted at" output
      const result = await runMeteorApp(tempDir, PORT, {
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

      // Assert that the Meteor React app is running correctly
      await assertMeteorReactApp(PORT);

      // Assert that the app is using Rspack
      await assertRspackScriptTag(PORT, true);

      // Update the client code
      await appendFileContent(tempDir, 'client/main.jsx', {
        content: 'if (Meteor.isDevelopment) console.log("Hello from dev client");',
      });
      await waitForPlaywrightConsole('Hello from dev client');

      // Update the server code
      await appendFileContent(tempDir, 'server/main.js', {
        content: 'if (Meteor.isDevelopment) console.log("Hello from dev server");',
      });
      await waitForMeteorOutput(
        result.outputLines,
        'Hello from dev server'
      );

      // Wait for a margin
      await wait(500);

      // Kill the meteor process
      await killMeteorProcess(meteorProcess);

      // Ensure any process on the port is killed
      await killProcessByPort(PORT);
      await killProcessByPort('8080');
    });

    test(`"meteor run --production" / should run and rebuild the app with Rspack in production`, async () => {
      // Run the Meteor app and wait for "restarted at" output
      const result = await runMeteorApp(tempDir, PORT, {
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

      await assertFileExist(tempDir, 'server/main.js');

      // Assert that the Meteor React app is running correctly
      await assertMeteorReactApp(PORT);

      // Assert that the app is using Rspack
      await assertRspackScriptTag(PORT, false);

      // Update the client code
      await appendFileContent(tempDir, 'client/main.jsx', {
        content: 'if (Meteor.isProduction) console.log("Hello from prod client");',
      });
      await waitForPlaywrightConsole('Hello from prod client');

      // Update the server code
      await appendFileContent(tempDir, 'server/main.js', {
        content: 'if (Meteor.isProduction) console.log("Hello from prod server");',
      });
      await waitForMeteorOutput(
        result.outputLines,
        'Hello from prod server'
      );

      // Wait for a margin
      await wait(500);

      // Kill the meteor process
      await killMeteorProcess(meteorProcess);

      // Ensure any process on the port is killed
      await killProcessByPort(PORT);
      await killProcessByPort('8080');
    });

    test(`"meteor test" / should run tests with Rspack`, async () => {
      const result = await runMeteorTests(tempDir, PORT, {
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
      await appendFileContent(tempDir, 'tests/main.js', {
        content: 'console.log("Hello from test");',
      });
      await waitForMeteorOutput(
        result.outputLines,
        'Hello from test'
      );

      // Kill the meteor process
      await killMeteorProcess(meteorProcess);

      // Ensure any process on the port is killed
      await killProcessByPort(PORT);
    });

    test(`"meteor test --once" / should run tests once with Rspack`, async () => {
      // Test the app with Rspack once
      await runMeteorTests(tempDir, PORT, {
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

      // Ensure any process on the port is killed
      await killProcessByPort(PORT);
    });

    test.only(`"meteor build" / should build the app with Rspack`, async () => {
      // Build the app with Rspack
      const { buildOutputDir, processResult } = await buildMeteorApp(tempDir, {
        commandOptions: ['--directory'],
        captureOutput: true
      });

      // Wait for a margin
      await wait(500);

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
      } finally {
        // Clean up the build output directory
        await cleanupTempDir(buildOutputDir);
      }
    });
  });
});
