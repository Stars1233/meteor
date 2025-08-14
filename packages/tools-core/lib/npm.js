const fs = require('fs');
const path = require('path');
const { spawnProcess } = require('./process');

/**
 * Checks if a npm dependency exists in the project.
 * First checks optimistically in node_modules folder, then checks package.json.
 * 
 * @param {string} dependency - The npm dependency name to check
 * @param {Object} [options] - Options for the check
 * @param {string} [options.cwd] - Current working directory (defaults to process.cwd())
 * @param {boolean} [options.checkNodeModules] - Whether to check in node_modules first (defaults to false)
 * @returns {boolean} True if the dependency exists, false otherwise
 */
export function checkNpmDependencyExists(dependency, options = {}) {
  const cwd = options.cwd || process.cwd();

  // First, optimistically check if the dependency exists in node_modules
  if (options.checkNodeModules) {
    const nodeModulesPath = path.join(cwd, 'node_modules', dependency);
    try {
      if (fs.existsSync(nodeModulesPath)) {
        // Check if it has a package.json to confirm it's a valid package
        const packageJsonPath = path.join(nodeModulesPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          return true;
        }
      }
    } catch (error) {
      // If there's an error checking the file system, continue to the fallback method
    }
  }

  // Fallback: Check package.json directly instead of using `npm ls`
  try {
    const packageJsonPath = path.join(cwd, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Check if the dependency is listed in any of the dependency sections
      return !!(
        (packageJson.dependencies && packageJson.dependencies[dependency]) ||
        (packageJson.devDependencies && packageJson.devDependencies[dependency]) ||
        (packageJson.optionalDependencies && packageJson.optionalDependencies[dependency]) ||
        (packageJson.peerDependencies && packageJson.peerDependencies[dependency])
      );
    }
  } catch (error) {
    // If there's an error reading or parsing package.json, return false
    return false;
  }

  // If we've reached this point, the dependency was not found
  return false;
}

/**
 * Checks if a npm binary exists in the project.
 * Looks for the binary in the node_modules/.bin directory.
 * 
 * @param {string} binary - The npm binary name to check
 * @param {Object} [options] - Options for the check
 * @param {string} [options.cwd] - Current working directory (defaults to process.cwd())
 * @returns {boolean} True if the binary exists, false otherwise
 */
export function checkNpmBinaryExists(binary, options = {}) {
  const cwd = options.cwd || process.cwd();
  const binaryPath = path.join(cwd, 'node_modules', '.bin', binary);

  try {
    // Check if the binary file exists and is executable
    const stats = fs.statSync(binaryPath);
    return stats.isFile() && (stats.mode & 0o111); // Check if executable bit is set
  } catch (error) {
    return false;
  }
}

/**
 * Installs a npm dependency using `meteor npm install`.
 * 
 * @param {string|string[]} dependencies - The npm dependency or dependencies to install
 * @param {Object} [options] - Options for the installation
 * @param {string} [options.cwd] - Current working directory (defaults to process.cwd())
 * @param {boolean} [options.dev=false] - If true, install as a dev dependency
 * @param {boolean} [options.exact=false] - If true, install with exact version
 * @returns {Promise<boolean>} A promise that resolves to true if installation succeeded, false otherwise
 */
export function installNpmDependency(dependencies, options = {}) {
  const cwd = options.cwd || process.cwd();
  const args = ['npm', 'install'];

  // Add flags based on options
  if (options.dev) {
    args.push('--save-dev');
  }

  if (options.exact) {
    args.push('--save-exact');
  }

  // Add dependencies to the command
  if (Array.isArray(dependencies)) {
    args.push(...dependencies);
  } else {
    args.push(dependencies);
  }

  return new Promise((resolve) => {
    const proc = spawnProcess('meteor', args, {
      cwd,
      onExit: (code) => {
        resolve(code === 0);
      },
      onError: () => {
        resolve(false);
      }
    });
  });
}


/**
 * Checks if a specific npm dependency version meets a semver condition.
 * First checks in node_modules if checkNodeModules is true, then checks project's package.json.
 * 
 * @param {string} dependency - The npm dependency name to check
 * @param {Object} [options] - Options for the check
 * @param {string} [options.cwd] - Current working directory (defaults to process.cwd())
 * @param {string} [options.versionRequirement] - The version requirement to check against (e.g., '6.0.0')
 * @param {string} [options.semverCondition='gte'] - The semver condition to use (e.g., 'gte', 'lt', 'eq')
 * @param {boolean} [options.checkNodeModules] - Whether to check in node_modules first (defaults to false)
 * @returns {boolean} True if the dependency version meets the condition, false otherwise
 */
export function checkNpmDependencyVersion(dependency, options = {}) {
  const semver = require('semver');
  const cwd = options.cwd || process.cwd();
  const versionRequirement = options.versionRequirement;
  const semverCondition = options.semverCondition || 'gte';

  if (!dependency) {
    throw new Error('Dependency name must be specified');
  }

  if (!versionRequirement) {
    throw new Error('Version requirement must be specified');
  }

  if (!semver[semverCondition]) {
    throw new Error(`Invalid semver condition: ${semverCondition}`);
  }

  // First, check in node_modules if the option is enabled
  if (options.checkNodeModules) {
    const nodeModulesPath = path.join(cwd, 'node_modules', dependency, 'package.json');
    try {
      if (fs.existsSync(nodeModulesPath)) {
        const packageJson = JSON.parse(fs.readFileSync(nodeModulesPath, 'utf8'));
        if (packageJson.version) {
          return semver[semverCondition](packageJson.version, versionRequirement);
        }
      }
    } catch (error) {
      // If there's an error reading the package.json, continue to the fallback method
    }
  }

  // Fallback: Check project's package.json directly
  try {
    const packageJsonPath = path.join(cwd, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Check all dependency sections for the package and its version
      const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

      for (const section of sections) {
        if (packageJson[section] && packageJson[section][dependency]) {
          const versionString = packageJson[section][dependency];
          // Extract the version number from the version string (removing ^ or ~ if present)
          const version = versionString.replace(/^[\^~]/, '');
          return semver[semverCondition](version, versionRequirement);
        }
      }
    }
  } catch (error) {
    // If there's an error reading or parsing package.json, return false
    return false;
  }

  // If we've reached this point, the dependency version couldn't be determined
  return false;
}
