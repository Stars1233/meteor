/**
 * @module dependencies
 * @description Functions for managing dependencies for RSPack plugin
 */

const {
  getGlobalState,
  setGlobalState,
} = require('meteor/tools-core/lib/global-state');
const {
  logProgress,
  logSuccess,
} = require('meteor/tools-core/lib/log');
const {
  getMeteorAppDir,
  isMeteorCoffeescriptProject,
} = require('meteor/tools-core/lib/meteor');
const {
  checkNpmDependencyExists,
  installNpmDependency,
  checkNpmDependencyVersion,
} = require('meteor/tools-core/lib/npm');
const {
  joinWithAnd,
} = require('meteor/tools-core/lib/string');

const {
  DEFAULT_RSPACK_VERSION,
  DEFAULT_METEOR_RSPACK_VERSION,
  DEFAULT_METEOR_RSPACK_REACT_HMR_VERSION,
  GLOBAL_STATE_KEYS,
} = require('./constants');

/**
 * Checks if RSPack is installed, and installs it if not
 * @returns {Promise<void>} A promise that resolves when the check/installation is complete
 * @throws {Error} If RSPack installation fails
 */
export async function ensureRSPackInstalled() {
  // Skip if already checked
  if (getGlobalState(GLOBAL_STATE_KEYS.RSPACK_INSTALLATION_CHECKED, false)) {
    return;
  }

  const appDir = getMeteorAppDir();
  const isRSPackInstalled =
    checkNpmDependencyExists('@rspack/cli', { cwd: appDir }) &&
    checkNpmDependencyVersion('@rspack/cli', {
      cwd: appDir,
      versionRequirement: DEFAULT_RSPACK_VERSION,
      semverCondition: 'gte',
    }) &&
    checkNpmDependencyExists('@rspack/core', { cwd: appDir }) &&
    checkNpmDependencyVersion('@rspack/core', {
      cwd: appDir,
      versionRequirement: DEFAULT_RSPACK_VERSION,
      semverCondition: 'gte',
    }) &&
    checkNpmDependencyExists('@meteorjs/rspack', { cwd: appDir }) &&
    checkNpmDependencyVersion('@meteorjs/rspack', {
      cwd: appDir,
      versionRequirement: DEFAULT_METEOR_RSPACK_VERSION,
      semverCondition: 'gte',
    });

  const rspackDependencies = [
    `@rspack/cli@${DEFAULT_RSPACK_VERSION}`,
    `@rspack/core@${DEFAULT_RSPACK_VERSION}`,
    `@meteorjs/rspack@${DEFAULT_METEOR_RSPACK_VERSION}`,
  ];
  if (!isRSPackInstalled) {
    logProgress(
      `RSPack not found. Installing ${joinWithAnd(rspackDependencies)}...`,
    );
    const success = await installNpmDependency(rspackDependencies, {
      cwd: appDir,
      dev: true,
    });

    if (!success) {
      throw new Error(
        `Failed to install RSPack. Please install it manually with: meteor npm install -D ${joinWithAnd(rspackDependencies)}`
      );
    }

    logSuccess('RSPack installed successfully.');
  }

  // Mark as checked
  setGlobalState(GLOBAL_STATE_KEYS.RSPACK_INSTALLATION_CHECKED, true);
}

/**
 * Checks if React is installed and sets global state accordingly
 * Sets global state and environment variables based on React detection
 * @returns {Promise<void>} A promise that resolves when the check is complete
 */
export async function checkReactInstalled() {
  // Skip if already checked
  if (getGlobalState(GLOBAL_STATE_KEYS.REACT_CHECKED, false)) {
    return;
  }

  const appDir = getMeteorAppDir();
  // Check if React is a dependency in the project
  const isReactInstalled = checkNpmDependencyExists('react', { cwd: appDir });

  if (isReactInstalled) {
    // Set environment variable to indicate React is enabled
    process.env.METEOR_REACT_ENABLED = 'true';
  } else {
    process.env.METEOR_REACT_ENABLED = 'false';
  }

  // Mark as checked
  setGlobalState(GLOBAL_STATE_KEYS.REACT_CHECKED, true);

  return isReactInstalled;
}

export async function ensureRSPackReactInstalled() {
  // Skip if already checked
  if (getGlobalState(GLOBAL_STATE_KEYS.RSPACK_REACT_INSTALLATION_CHECKED, false)) {
    return;
  }

  const appDir = getMeteorAppDir();
  const isRSPackReactInstalled =
    checkNpmDependencyExists('@rspack/plugin-react-refresh', { cwd: appDir }) &&
    checkNpmDependencyVersion('@rspack/plugin-react-refresh', {
      cwd: appDir,
      versionRequirement: DEFAULT_METEOR_RSPACK_REACT_HMR_VERSION,
      semverCondition: 'gte',
    });

  const rspackReactDependencies = [
    `@rspack/plugin-react-refresh@${DEFAULT_METEOR_RSPACK_REACT_HMR_VERSION}`,
  ];
  if (!isRSPackReactInstalled) {
    logProgress(
      `RSPack React not found. Installing ${joinWithAnd(rspackReactDependencies)}...`,
    );
    const success = await installNpmDependency(rspackReactDependencies, {
      cwd: appDir,
      dev: true,
    });

    if (!success) {
      throw new Error(
        `Failed to install RSPack React. Please install it manually with: meteor npm install -D ${joinWithAnd(rspackReactDependencies)}`
      );
    }

    logSuccess('RSPack React installed successfully.');
  }

  // Mark as checked
  setGlobalState(GLOBAL_STATE_KEYS.RSPACK_REACT_INSTALLATION_CHECKED, true);
}

/**
 * Checks if Coffeescript is installed and sets global state accordingly
 * Sets global state and environment variables based on Coffeescript detection
 * @returns {Promise<void>} A promise that resolves when the check is complete
 */
export async function checkCoffeescriptInstalled() {
  // Skip if already checked
  if (getGlobalState(GLOBAL_STATE_KEYS.COFFEESCRIPT_CHECKED, false)) {
    return;
  }

  const appDir = getMeteorAppDir();
  const isCoffescriptInstalled =
    checkNpmDependencyExists('coffeescript', { cwd: appDir }) ||
    isMeteorCoffeescriptProject();

  if (isCoffescriptInstalled) {
    // Set environment variable to indicate React is enabled
    process.env.METEOR_COFFEESCRIPT_ENABLED = 'true';
  } else {
    process.env.METEOR_COFFEESCRIPT_ENABLED = 'false';
  }

  // Mark as checked
  setGlobalState(GLOBAL_STATE_KEYS.COFFEESCRIPT_CHECKED, true);

  return isCoffescriptInstalled;
}

export async function ensureRSPackCoffeescriptInstalled() {
  // Skip if already checked
  if (getGlobalState(GLOBAL_STATE_KEYS.RSPACK_COFFEESCRIPT_INSTALLATION_CHECKED, false)) {
    return;
  }

  const appDir = getMeteorAppDir();
  const isRSPackCoffeescriptInstalled =
  checkNpmDependencyExists('coffeescript', { cwd: appDir }) &&
  checkNpmDependencyVersion('coffeescript', {
    cwd: appDir,
    versionRequirement: DEFAULT_METEOR_RSPACK_COFFEESCRIPT_VERSION,
    semverCondition: 'gte',
  }) &&
    checkNpmDependencyExists('coffee-loader', { cwd: appDir }) &&
    checkNpmDependencyVersion('coffee-loader', {
      cwd: appDir,
      versionRequirement: DEFAULT_METEOR_RSPACK_COFFEE_LOADER_VERSION,
      semverCondition: 'gte',
    }) &&
    checkNpmDependencyExists('swc-loader', { cwd: appDir }) &&
    checkNpmDependencyVersion('swc-loader', {
      cwd: appDir,
      versionRequirement: DEFAULT_METEOR_RSPACK_SWC_LOADER_VERSION,
      semverCondition: 'gte',
    });

  const rspackCoffeescriptDependencies = [
    `coffeescript@${DEFAULT_METEOR_RSPACK_COFFEESCRIPT_VERSION}`,
    `coffee-loader@${DEFAULT_METEOR_RSPACK_COFFEE_LOADER_VERSION}`,
    `swc-loader@${DEFAULT_METEOR_RSPACK_SWC_LOADER_VERSION}`,
  ];
  if (!isRSPackCoffeescriptInstalled) {
    logProgress(
      `RSPack Coffeescript not found. Installing ${joinWithAnd(rspackCoffeescriptDependencies)}...`,
    );
    const success = await installNpmDependency(rspackCoffeescriptDependencies, {
      cwd: appDir,
      dev: true,
    });

    if (!success) {
      throw new Error(
        `Failed to install RSPack Coffeescript. Please install it manually with: meteor npm install -D ${joinWithAnd(rspackCoffeescriptDependencies)}`
      );
    }

    logSuccess('RSPack Coffeescript installed successfully.');
  }

  // Mark as checked
  setGlobalState(GLOBAL_STATE_KEYS.RSPACK_COFFEESCRIPT_INSTALLATION_CHECKED, true);
}
