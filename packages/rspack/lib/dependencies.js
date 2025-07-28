/**
 * @module dependencies
 * @description Functions for managing dependencies for RSPack plugin
 */
import { DEFAULT_METEOR_RSPACK_SWC_HELPERS_VERSION } from "./constants";

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
  DEFAULT_METEOR_RSPACK_COFFEESCRIPT_VERSION,
  DEFAULT_METEOR_RSPACK_COFFEE_LOADER_VERSION,
  DEFAULT_METEOR_RSPACK_SWC_LOADER_VERSION,
  GLOBAL_STATE_KEYS,
} = require('./constants');

/**
 * Generic function to ensure dependencies are installed with correct versions
 * @param {Object[]} dependencies - Array of dependency objects with name, version, and semverCondition
 * @param {string} globalStateKey - Global state key to track if check has been done
 * @param {string} packageName - Name of the package for logging purposes
 * @returns {Promise<void>} A promise that resolves when the check/installation is complete
 * @throws {Error} If installation fails
 */
async function ensureDependenciesInstalled(dependencies, globalStateKey, packageName) {
  // Skip if already checked
  if (getGlobalState(globalStateKey, false)) {
    return;
  }

  const appDir = getMeteorAppDir();

  // Filter dependencies that need to be installed (missing or wrong version)
  const allDepsToInstall = dependencies.filter(dep =>
    !checkNpmDependencyExists(dep.name, { cwd: appDir }) ||
    !checkNpmDependencyVersion(dep.name, {
      cwd: appDir,
      versionRequirement: dep.version,
      semverCondition: dep.semverCondition || 'gte',
    })
  );

  // Format dependencies for installation
  const dependencyStrings = allDepsToInstall.map(dep => `${dep.name}@${dep.version}`);

  if (allDepsToInstall.length > 0) {
    let success;
    logProgress(
      `${packageName} dependencies need to be installed. Installing ${joinWithAnd(dependencyStrings)}...`,
    );
    // Install dev dependencies
    const devDepsToInstall = allDepsToInstall.filter(dep => dep.dev === true || dep.dev == null);
    if (devDepsToInstall.length > 0) {
      const devDepsStrings = devDepsToInstall.map(dep => `${dep.name}@${dep.version}`);
      success = await installNpmDependency(devDepsStrings, {
        cwd: appDir,
        dev: true,
      });
    }

    const depsToInstall = allDepsToInstall.filter(dep => dep.dev === false);
    if (depsToInstall.length > 0) {
      const depsStrings = depsToInstall.map(dep => `${dep.name}@${dep.version}`);
      const depsSuccess = await installNpmDependency(depsStrings, {
        cwd: appDir,
        dev: false,
      });
      success = success && depsSuccess;
    }

    if (!success) {
      throw new Error(
        `Failed to install ${packageName} dependencies. Please install them manually with: meteor npm install -D ${joinWithAnd(allDepsToInstall)}`
      );
    }

    logSuccess(`${packageName} dependencies installed successfully.`);
  }

  // Mark as checked
  setGlobalState(globalStateKey, true);
}

/**
 * Checks if RSPack is installed, and installs it if not
 * @returns {Promise<void>} A promise that resolves when the check/installation is complete
 * @throws {Error} If RSPack installation fails
 */
export async function ensureRSPackInstalled() {
  const dependencies = [
    { name: '@rspack/cli', version: DEFAULT_RSPACK_VERSION, semverCondition: 'gte', dev: true },
    { name: '@rspack/core', version: DEFAULT_RSPACK_VERSION, semverCondition: 'gte', dev: true },
    { name: '@meteorjs/rspack', version: DEFAULT_METEOR_RSPACK_VERSION, semverCondition: 'gte', dev: true },
    { name: '@swc/helpers', version: DEFAULT_METEOR_RSPACK_SWC_HELPERS_VERSION, semverCondition: 'gte', dev: false },
  ];

  await ensureDependenciesInstalled(
    dependencies,
    GLOBAL_STATE_KEYS.RSPACK_INSTALLATION_CHECKED,
    'RSPack',
  );
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
  const dependencies = [
    { name: '@rspack/plugin-react-refresh', version: DEFAULT_METEOR_RSPACK_REACT_HMR_VERSION, semverCondition: 'gte', dev: true }
  ];

  await ensureDependenciesInstalled(
    dependencies,
    GLOBAL_STATE_KEYS.RSPACK_REACT_INSTALLATION_CHECKED,
    'RSPack React'
  );
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
  const dependencies = [
    { name: 'coffeescript', version: DEFAULT_METEOR_RSPACK_COFFEESCRIPT_VERSION, semverCondition: 'gte', dev: true },
    { name: 'coffee-loader', version: DEFAULT_METEOR_RSPACK_COFFEE_LOADER_VERSION, semverCondition: 'gte', dev: true },
    { name: 'swc-loader', version: DEFAULT_METEOR_RSPACK_SWC_LOADER_VERSION, semverCondition: 'gte', dev: true }
  ];

  await ensureDependenciesInstalled(
    dependencies,
    GLOBAL_STATE_KEYS.RSPACK_COFFEESCRIPT_INSTALLATION_CHECKED,
    'RSPack Coffeescript'
  );
}
