/**
 * @module rspack_plugin
 * @description RSPack Plugin for Meteor
 * 
 * This is the main entry point for the RSPack plugin. It orchestrates the integration
 * between RSPack and Meteor by:
 * 1. Ensuring RSPack and related dependencies are installed
 * 2. Setting up the build context directory
 * 3. Configuring Meteor settings for RSPack
 * 4. Starting RSPack processes based on the Meteor command (run or build)
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
  ensureRSPackInstalled,
} = require('./lib/dependencies');

const {
  ensureRSPackBuildContextExists
} = require('./lib/build-context');

const {
  startRSPackClientServe,
  startRSPackServerWatch,
  runRSPackBuild,
  cleanup
} = require('./lib/processes');

const {
  configureMeteorForRSPack
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
  getMeteorAppEntrypoints
} = require('meteor/tools-core/lib/meteor');

const {
  logError,
} = require('meteor/tools-core/lib/log');

// Get entry points from Meteor configuration
setGlobalState(GLOBAL_STATE_KEYS.INITIAL_ENTRYPONTS, getMeteorAppEntrypoints());

// Main entry point - using top-level await
try {
  // Ensure RSPack is installed
  await ensureRSPackInstalled();

  // Ensure the RSPack build context directory exists
  ensureRSPackBuildContextExists();

  // Configure Meteor settings for RSPack
  configureMeteorForRSPack();

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

    // For 'run' command, start RSPack in appropriate modes with distinct callbacks
    startRSPackClientServe({ onCompile: onCompileClient });
    startRSPackServerWatch({ onCompile: onCompileServer });

    // Wait for first compilation to complete
    await waitForFirstCompilation(clientFirstCompile, serverFirstCompile, clientFirstCompilePromise, serverFirstCompilePromise);
  } else if (isMeteorAppBuild()) {
    // For 'build' command, run RSPack build without watch mode
    // Run client and server builds in parallel and wait for both to complete
    await Promise.all([
      runRSPackBuild({ isClient: true, isServer: false }),
      runRSPackBuild({ isServer: true, isClient: false })
    ]);
  }
} catch (error) {
  logError(`RSPack plugin error: ${error.message}`);
  throw error;
}
