/**
 * @module rspack_plugin
 * @description Rspack Plugin for Meteor
 *
 * This is the main entry point for the Rspack plugin. It orchestrates the integration
 * between Rspack and Meteor by:
 * 1. Ensuring Rspack and related dependencies are installed
 * 2. Setting up the build context directory
 * 3. Configuring Meteor settings for Rspack
 * 4. Starting Rspack processes based on the Meteor command (run or build)
 * 5. Handling cleanup when the plugin is stopped
 *
 * The plugin uses top-level await to ensure asynchronous operations complete
 * before Meteor continues execution.
 */

// Import modules from lib
const {
  GLOBAL_STATE_KEYS,
} = require('./lib/constants');

const {
  ensureRspackInstalled,
  checkReactInstalled,
  ensureRspackReactInstalled,
  checkCoffeescriptInstalled,
  ensureRspackCoffeescriptInstalled,
} = require('./lib/dependencies');

const {
  ensureRspackBuildContextExists,
  ensureRspackConfigExists,
} = require('./lib/build-context');

const {
  startRspackClientServe,
  startRspackServerWatch,
  runRspackBuild,
  cleanup
} = require('./lib/processes');

const {
  configureMeteorForRspack
} = require('./lib/config');

const {
  setupCompilationTracking,
  waitForFirstCompilation
} = require('./lib/compilation');

const {
  setGlobalState
} = require('meteor/tools-core/lib/global-state');

const {
  isMeteorAppRun,
  isMeteorAppBuild,
  getMeteorInitialAppEntrypoints,
  getMeteorAppEntrypoints,
  isMeteorAppTest,
  isMeteorAppTestWatch,
  isMeteorAppDevelopment,
  isMeteorAppProduction,
} = require('meteor/tools-core/lib/meteor');

const {
  logError,
} = require('meteor/tools-core/lib/log');

// Get entry points from Meteor configuration
setGlobalState(GLOBAL_STATE_KEYS.INITIAL_ENTRYPONTS, getMeteorAppEntrypoints());

// Main entry point - using top-level await
try {
  // Ensure Rspack is installed
  await ensureRspackInstalled();

  // Check if Rspack React is installed
  if (checkReactInstalled()) {
    await ensureRspackReactInstalled();
  }

  if (checkCoffeescriptInstalled()) {
    await ensureRspackCoffeescriptInstalled();
  }

  // Ensure the Rspack build context directory exists
  ensureRspackBuildContextExists();

  // Ensure the rspack.config.js file exists at the project level
  ensureRspackConfigExists();

  // Configure Meteor settings for Rspack
  configureMeteorForRspack();

  // Register cleanup handler
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit();
  });

  // Handle different Meteor commands
  if (isMeteorAppRun()) {
    // Setup compilation tracking and callbacks
    const {
      clientFirstCompile,
      serverFirstCompile,
      clientFirstCompilePromise,
      serverFirstCompilePromise,
      onCompileClient,
      onCompileServer,
    } = setupCompilationTracking();

    // For 'run' command, start Rspack in appropriate modes with distinct callbacks
    if (isMeteorAppDevelopment()) {
      startRspackClientServe({ onCompile: onCompileClient });
      startRspackServerWatch({ onCompile: onCompileServer });
    } else if (isMeteorAppProduction()) {
      runRspackBuild({
        isClient: true,
        isServer: false,
        watch: true,
        onCompile: onCompileClient,
      });
      runRspackBuild({
        isServer: true,
        isClient: false,
        watch: true,
        onCompile: onCompileServer,
      });
    }

    // Wait for first compilation to complete
    await waitForFirstCompilation(clientFirstCompile, serverFirstCompile, clientFirstCompilePromise, serverFirstCompilePromise);
  } else if (isMeteorAppTest()) {
    const initialEntrypoints = getMeteorInitialAppEntrypoints();

    // Setup compilation tracking and callbacks
    const {
      clientFirstCompile,
      serverFirstCompile,
      clientFirstCompilePromise,
      serverFirstCompilePromise,
      onCompileClient,
      onCompileServer,
    } = setupCompilationTracking();

    if (initialEntrypoints?.testModule?.client || initialEntrypoints?.testModule?.server) {
      runRspackBuild({
        isClient: true,
        isServer: false,
        watch: isMeteorAppTestWatch(),
        onCompile: onCompileClient,
        label: 'Test',
      });

      runRspackBuild({
        isServer: true,
        isClient: false,
        watch: isMeteorAppTestWatch(),
        onCompile: onCompileServer,
        label: 'Test',
      });

      // Wait for first compilation to complete
      await waitForFirstCompilation(clientFirstCompile, serverFirstCompile, clientFirstCompilePromise, serverFirstCompilePromise);
    } else {
      runRspackBuild({
        isTestModule: true,
        isClient: false,
        isServer: true,
        watch: isMeteorAppTestWatch(),
        onCompile: onCompileServer,
        label: 'Test',
      });
      await waitForFirstCompilation(clientFirstCompile, serverFirstCompile, clientFirstCompilePromise, serverFirstCompilePromise, { target: 'server' });
    }

  } else if (isMeteorAppBuild()) {
    // For 'build' command, run Rspack build without watch mode
    // Run client and server builds in parallel and wait for both to complete
    await Promise.all([
      runRspackBuild({ isClient: true, isServer: false }),
      runRspackBuild({ isServer: true, isClient: false }),
    ]);
  }
} catch (error) {
  logError(`Rspack plugin error: ${error.message}`);
  throw error;
}
