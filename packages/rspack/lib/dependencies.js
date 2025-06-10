/**
 * @module dependencies
 * @description Functions for managing dependencies for RSPack plugin
 */

const {
  checkNpmDependencyExists,
  installNpmDependency
} = require('meteor/tools-core/lib/npm');

const {
  logProgress,
  logError,
  logSuccess,
  logInfo
} = require('meteor/tools-core/lib/log');

const {
  getMeteorAppDir
} = require('meteor/tools-core/lib/meteor');

const {
  getGlobalState,
  setGlobalState
} = require('meteor/tools-core/lib/global-state');

const {
  DEFAULT_RSPACK_VERSION,
  DEFAULT_REACT_REFRESH_PLUGIN_VERSION,
  GLOBAL_STATE_KEYS
} = require('./constants');

/**
 * Checks if RSPack is installed, and installs it if not
 * @returns {Promise<void>} A promise that resolves when the check/installation is complete
 * @throws {Error} If RSPack installation fails
 */
async function ensureRSPackInstalled() {
  // Skip if already checked
  if (getGlobalState(GLOBAL_STATE_KEYS.RSPACK_INSTALLATION_CHECKED, false)) {
    return;
  }

  const appDir = getMeteorAppDir();
  const isRSPackInstalled = await checkNpmDependencyExists('@rspack/cli', { cwd: appDir });

  if (!isRSPackInstalled) {
    logProgress(`RSPack not found. Installing @rspack/cli@${DEFAULT_RSPACK_VERSION}...`);
    const success = await installNpmDependency(`@rspack/cli@${DEFAULT_RSPACK_VERSION}`, {
      cwd: appDir,
      exact: true,
      dev: true,
    });

    if (!success) {
      throw new Error('Failed to install RSPack. Please install it manually with: meteor npm install @rspack/cli');
    }

    logSuccess('RSPack installed successfully.');
  }

  // Mark as checked
  setGlobalState(GLOBAL_STATE_KEYS.RSPACK_INSTALLATION_CHECKED, true);
}

/**
 * Checks if React is installed, and if so, installs the React Refresh Plugin if not found
 * Sets global state and environment variables based on React detection
 * @returns {Promise<void>} A promise that resolves when the check/installation is complete
 */
async function ensureReactRefreshPluginInstalled() {
  // Skip if already checked
  if (getGlobalState(GLOBAL_STATE_KEYS.REACT_REFRESH_PLUGIN_CHECKED, false)) {
    return;
  }

  const appDir = getMeteorAppDir();

  // Check if React is a dependency in the project
  const isReactInstalled = await checkNpmDependencyExists('react', { cwd: appDir });

  if (isReactInstalled) {
    setGlobalState(GLOBAL_STATE_KEYS.IS_REACT_ENABLED, true);

    // Set environment variable to indicate React is enabled
    process.env.METEOR_REACT_ENABLED = 'true';

    // Check if the React Refresh Plugin is installed
    const isReactRefreshPluginInstalled = await checkNpmDependencyExists('@rspack/plugin-react-refresh', { cwd: appDir, exact: true, dev: true });

    if (!isReactRefreshPluginInstalled) {
      logInfo('React detected in the project. Checking for React Refresh Plugin...');
      logProgress(`React Refresh Plugin not found. Installing @rspack/plugin-react-refresh@${DEFAULT_REACT_REFRESH_PLUGIN_VERSION}...`);
      const success = await installNpmDependency(`@rspack/plugin-react-refresh@${DEFAULT_REACT_REFRESH_PLUGIN_VERSION}`, {
        cwd: appDir,
        exact: true,
        dev: true,
      });

      if (!success) {
        logError('Failed to install React Refresh Plugin. You may need to install it manually with: meteor npm install @rspack/plugin-react-refresh');
        // Continue execution even if installation fails
      } else {
        logSuccess('React Refresh Plugin installed successfully.');
      }
    }
  } else {
    setGlobalState(GLOBAL_STATE_KEYS.IS_REACT_ENABLED, false);
    process.env.METEOR_REACT_ENABLED = 'false';
  }

  // Mark as checked
  setGlobalState(GLOBAL_STATE_KEYS.REACT_REFRESH_PLUGIN_CHECKED, true);
}

module.exports = {
  ensureRSPackInstalled,
  ensureReactRefreshPluginInstalled
};
