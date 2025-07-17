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
const { getMeteorAppDir } = require('meteor/tools-core/lib/meteor');
const {
  checkNpmDependencyExists,
  installNpmDependency,
  checkNpmDependencyVersion,
} = require('meteor/tools-core/lib/npm');

const {
  DEFAULT_RSPACK_VERSION,
  DEFAULT_METEOR_RSPACK_VERSION,
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
    (await checkNpmDependencyExists('@rspack/cli', { cwd: appDir })) &&
    (await checkNpmDependencyVersion('@rspack/cli', {
      cwd: appDir,
      versionRequirement: DEFAULT_RSPACK_VERSION,
      semverCondition: 'gte',
    })) &&
    (await checkNpmDependencyExists('@rspack/core', { cwd: appDir })) &&
    (await checkNpmDependencyVersion('@rspack/core', {
      cwd: appDir,
      versionRequirement: DEFAULT_RSPACK_VERSION,
      semverCondition: 'gte',
    })) &&
    (await checkNpmDependencyExists('@meteorjs/rspack', { cwd: appDir })) &&
    (await checkNpmDependencyVersion('@meteorjs/rspack', {
      cwd: appDir,
      versionRequirement: DEFAULT_METEOR_RSPACK_VERSION,
      semverCondition: 'gte',
    }));

  if (!isRSPackInstalled) {
    logProgress(
      `RSPack not found. Installing @rspack/cli@${DEFAULT_RSPACK_VERSION}...`
    );
    const success = await installNpmDependency(
      [
        `@rspack/cli@${DEFAULT_RSPACK_VERSION}`,
        `@rspack/core@${DEFAULT_RSPACK_VERSION}`,
        `@meteorjs/rspack@${DEFAULT_METEOR_RSPACK_VERSION}`,
      ],
      {
        cwd: appDir,
        dev: true
      }
    );

    if (!success) {
      throw new Error(
        'Failed to install RSPack. Please install it manually with: meteor npm install @rspack/cli'
      );
    }

    logSuccess('RSPack installed successfully.');
  }

  // Mark as checked
  setGlobalState(GLOBAL_STATE_KEYS.RSPACK_INSTALLATION_CHECKED, true);
}
