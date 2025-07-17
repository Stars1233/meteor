const fs = require('fs');
const path = require('path');
const { spawnProcess } = require('./process');
const semver = require('semver');

/**
 * Checks if a npm dependency exists in the project.
 * First checks optimistically in node_modules folder, then falls back to `meteor npm ls`.
 * 
 * @param {string} dependency - The npm dependency name to check
 * @param {Object} [options] - Options for the check
 * @param {string} [options.cwd] - Current working directory (defaults to process.cwd())
 * @returns {Promise<boolean>} A promise that resolves to true if the dependency exists, false otherwise
 */
export async function checkNpmDependencyExists(dependency, options = {}) {
  const cwd = options.cwd || process.cwd();

  // First, optimistically check if the dependency exists in node_modules
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

  // Fallback: Use `meteor npm ls` to check if the dependency exists
  return new Promise((resolve) => {
    let output = '';

    const proc = spawnProcess('meteor', ['npm', 'ls', dependency, '--depth=0'], {
      cwd,
      onStdout: (data) => {
        output += data;
      },
      onStderr: () => {
        // Ignore stderr output
      },
      onExit: (code) => {
        // npm ls exits with code 0 if the package is found, 1 if not found
        resolve(code === 0 && !output.includes('(empty)') && !output.includes('missing:'));
      },
      onError: () => {
        resolve(false);
      }
    });
  });
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
 * 
 * @param {string} dependency - The npm dependency name to check
 * @param {Object} [options] - Options for the check
 * @param {string} [options.cwd] - Current working directory (defaults to process.cwd())
 * @param {string} [options.versionRequirement] - The version requirement to check against (e.g., '6.0.0')
 * @param {string} [options.semverCondition='gte'] - The semver condition to use (e.g., 'gte', 'lt', 'eq')
 * @returns {Promise<boolean>} A promise that resolves to true if the dependency version meets the condition, false otherwise
 */
export async function checkNpmDependencyVersion(dependency, options = {}) {
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

  // First, try to get the version from package.json in node_modules
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

  // Fallback: Use `meteor npm ls` to get the dependency version
  return new Promise((resolve) => {
    let output = '';

    const proc = spawnProcess('meteor', ['npm', 'ls', dependency, '--depth=0', '--json'], {
      cwd,
      onStdout: (data) => {
        output += data;
      },
      onStderr: () => {
        // Ignore stderr output
      },
      onExit: (code) => {
        if (code !== 0) {
          resolve(false);
          return;
        }

        try {
          const jsonOutput = JSON.parse(output);
          const dependencies = jsonOutput.dependencies || {};
          const dep = dependencies[dependency];

          if (dep && dep.version) {
            resolve(semver[semverCondition](dep.version, versionRequirement));
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
      },
      onError: () => {
        resolve(false);
      }
    });
  });
}
