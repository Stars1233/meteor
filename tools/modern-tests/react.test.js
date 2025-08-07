import {
  killProcessByPort,
  setupMeteorApp,
  runMeteorApp,
  cleanupTempDir,
  killMeteorProcess,
  createMeteorApp,
  runMeteorCommand, wait
} from "./helpers";
import { assertMeteorReactApp, assertRspackScriptTag } from './assertions';
import fs from 'fs-extra';
import path from 'path';
import waitOn from "wait-on";

describe('React App Bundling', () => {
  describe.skip('Meteor Creator', () => {
    const PORT = 3100;

    test('"meteor create" should create a new Meteor app with --react example', async () => {
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

  describe.skip('Meteor Bundler', () => {
    const PORT = 3101;
    let meteorProcess;
    let tempDir;

    beforeAll(async () => {
      // Setup the Meteor app
      tempDir = (await setupMeteorApp('react'))?.tempDir;
    });

    afterAll(async () => {
      // Clean up the temporary directory
      await cleanupTempDir(tempDir);
    });

    test(`"meteor run" should start the app at "http://localhost:${PORT}"`, async () => {
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

  describe('Meteor+Rspack Bundler', () => {
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
      await runMeteorCommand('add', ['rspack'], tempDir);
    });

    afterAll(async () => {
      // Clean up the temporary directory
      await cleanupTempDir(tempDir);
    });

    test(`"meteor run" should install Rspack and restart the app`, async () => {
      // Run the Meteor app and wait for "restarted at" output
      const result = await runMeteorApp(tempDir, PORT, {
        waitForOutput: "=> Meteor server restarted at:",
      });
      meteorProcess = result.meteorProcess;

      // Wait for a margin
      await wait(500);

      // Kill the meteor process
      await killMeteorProcess(meteorProcess);

      // Ensure any process on the port is killed
      await killProcessByPort(PORT);
      await killProcessByPort('8080');
    });

    test(`"meteor run" should run the app with Rspack`, async () => {
      // Run the Meteor app and wait for "restarted at" output
      const result = await runMeteorApp(tempDir, PORT, {
        waitForOutput: "=> App running at:",
      });
      meteorProcess = result.meteorProcess;

      // Wait for a margin
      await wait(500);

      // Assert that the Meteor React app is running correctly
      await assertMeteorReactApp(PORT);

      // Assert that the app is using Rspack
      await assertRspackScriptTag(PORT, true);

      // Kill the meteor process
      await killMeteorProcess(meteorProcess);

      // Ensure any process on the port is killed
      await killProcessByPort(PORT);
      await killProcessByPort('8080');
    });

    test(`"meteor run --production" should run the app with Rspack in production`, async () => {
      // Run the Meteor app and wait for "restarted at" output
      const result = await runMeteorApp(tempDir, PORT, {
        waitForOutput: "=> App running at:",
        commandOptions: ['--production'],
      });
      meteorProcess = result.meteorProcess;

      // Wait for a margin
      await wait(500);

      // Assert that the Meteor React app is running correctly
      await assertMeteorReactApp(PORT);

      // Assert that the app is using Rspack
      await assertRspackScriptTag(PORT, false);

      // Kill the meteor process
      await killMeteorProcess(meteorProcess);

      // Ensure any process on the port is killed
      await killProcessByPort(PORT);
      await killProcessByPort('8080');
    });
  });
});
