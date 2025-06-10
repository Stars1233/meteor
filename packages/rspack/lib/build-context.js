/**
 * @module build-context
 * @description Functions for managing build context and module files for RSPack plugin
 */

const fs = require('fs');
const path = require('path');

const {
  logInfo,
  logSuccess,
  logError
} = require('meteor/tools-core/lib/log');

const {
  getMeteorAppDir,
  getMeteorAppEntrypoints,
  getMeteorInitialAppEntrypoints,
  isMeteorAppDevelopment,
  getMeteorAppPackages,
  addEnvSuffixToFilename
} = require('meteor/tools-core/lib/meteor');

const {
  getGlobalState,
  setGlobalState
} = require('meteor/tools-core/lib/global-state');

const {
  addGitignoreEntries
} = require('meteor/tools-core/lib/git');

const {
  RSPACK_BUILD_CONTEXT,
  RSPACK_ASSETS_CONTEXT,
  RSPACK_BUNDLES_CONTEXT,
  GLOBAL_STATE_KEYS
} = require('./constants');

/**
 * Gets entry points from Meteor configuration
 * Retrieves from global state if already stored, otherwise gets from Meteor
 * @returns {Object} Object containing entry points for client and server
 */
function getInitialEntrypoints() {
  const existingEntrypoint = getGlobalState(GLOBAL_STATE_KEYS.INITIAL_ENTRYPONTS);
  if (existingEntrypoint) return existingEntrypoint;
  const initialEntrypoints = getMeteorInitialAppEntrypoints();
  const hasInitialEntrypoints = initialEntrypoints && Object.values(initialEntrypoints).length > 0 && Object.values(initialEntrypoints).every((value) => value != null);
  if (hasInitialEntrypoints) {
    setGlobalState(GLOBAL_STATE_KEYS.INITIAL_ENTRYPONTS, initialEntrypoints);
  }
  return initialEntrypoints;
}

/**
 * Ensures the RSPack build context directory exists
 * Creates the directory if it doesn't exist and adds it to .gitignore
 * @returns {string} Path to the build context directory
 * @throws {Error} If directory creation fails
 */
function ensureRSPackBuildContextExists() {
  const appDir = getMeteorAppDir();
  const buildContextPath = path.join(appDir, RSPACK_BUILD_CONTEXT);

  if (!fs.existsSync(buildContextPath)) {
    try {
      fs.mkdirSync(buildContextPath, { recursive: true });
    } catch (error) {
      logError(`Failed to create RSPack build context directory: ${error.message}`);
      throw error;
    }
  }

  addGitignoreEntries(
    appDir,
    [
      RSPACK_BUILD_CONTEXT,
      `public/${RSPACK_BUNDLES_CONTEXT}`,
      `public/${RSPACK_ASSETS_CONTEXT}`,
      `private/${RSPACK_ASSETS_CONTEXT}`,
    ],
    'Meteor-RSPack build context directory',
  );

  return buildContextPath;
}

/**
 * Ensures module files exist in the build context directory
 * Creates default module files if they don't exist
 * @returns {void}
 */
function ensureModuleFilesExist() {
  const appDir = getMeteorAppDir();

  const moduleFiles = {
    'main-client.hmr.js': '// Main client entry point for RSPack to enable HMR\n',
    'main-client.js': '// Main client entry point for Meteor compiled by RSPack\n',
    'main-server.js': '// Main server entry point for Meteor compiled by RSPack\n',
    'test-client.js': '// Test client entry point for Meteor compiled by RSPack\n',
    'test-server.js': '// Test server entry point for Meteor compiled by RSPack\n',
  };

  Object.entries(moduleFiles).forEach(([filename, defaultContent]) => {
    // Add environment suffix for main client and server files
    const actualFilename = (['main-client.js', 'main-client.hmr.js', 'main-server.js'].includes(filename))
      ? addEnvSuffixToFilename(filename)
      : filename;

    const filePath = `${appDir}/${RSPACK_BUILD_CONTEXT}/${actualFilename}`;

    if (!fs.existsSync(filePath)) {
      try {
        fs.writeFileSync(filePath, defaultContent, 'utf8');
      } catch (error) {
        logError(`Failed to create module file ${actualFilename}: ${error.message}`);
      }
    }
  });
}

/**
 * Writes custom content to the main-client.js entrypoint when in dev mode.
 * This helper function can be used to inject custom code into the client entry point.
 * It preserves existing requires and only adds new ones in a separate function.
 *
 * @returns {boolean} - True if the content was written successfully, false otherwise
 */
function writeMainClientContent() {
  // Only write custom content in development mode
  if (!isMeteorAppDevelopment()) {
    return false;
  }

  const appDir = getMeteorAppDir();
  const filePath = `${appDir}/${RSPACK_BUILD_CONTEXT}/${addEnvSuffixToFilename('main-client.js')}`;

  try {
    // Ensure the file exists before writing to it
    if (!fs.existsSync(filePath)) {
      ensureModuleFilesExist();
    }

    const isReactEnabled = !!process.env.METEOR_REACT_ENABLED;
    const meteorPackages = getMeteorAppPackages().map(pkg => `meteor/${pkg}`);

    // Add React packages if enabled
    const allPackages = isReactEnabled 
      ? ['react', 'react-dom', ...meteorPackages] 
      : meteorPackages;

    // Initialize with base content if file doesn't exist or is empty
    let fileContent = '';
    const existing = new Set();
    let funcCount = 0;

    // Define the globalThis.module check block
    const globalThisModuleBlock = `if (typeof globalThis.module === 'undefined') {
    globalThis.module = { exports: {} };
}
if (typeof globalThis.exports === 'undefined') {
    globalThis.exports = globalThis.module.exports;
}`;

    // Read existing file content if it exists
    if (fs.existsSync(filePath)) {
      fileContent = fs.readFileSync(filePath, 'utf8');

      // Check if the globalThis.module block exists
      if (!fileContent.includes('typeof globalThis.module === \'undefined\'')) {
        // Add the block at the top of the file
        fileContent = fileContent + '\n' + globalThisModuleBlock + '\n';
        // Write the updated content back to the file
        fs.writeFileSync(filePath, fileContent, 'utf8');
      }

      // Parse existing requires
      const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
      let match;
      while ((match = requireRegex.exec(fileContent)) !== null) {
        existing.add(match[1]);
      }

      // Find the highest function count to ensure unique function names
      const funcCountRegex = /lazyExternalImports(\d+)/g;
      while ((match = funcCountRegex.exec(fileContent)) !== null) {
        funcCount = Math.max(funcCount, parseInt(match[1], 10) + 1);
      }
    } else {
      // Initialize with base content if file doesn't exist
      fileContent = globalThisModuleBlock + '\n';
    }

    // Find new packages that need to be required
    const newRequires = [];
    for (const pkg of allPackages) {
      if (!existing.has(pkg)) {
        existing.add(pkg);
        newRequires.push(`require('${pkg}')`);
      }
    }

    // If there are new requires, add them in a new function
    if (newRequires.length) {
      // Generate a unique function name
      const fnName = `lazyExternalImports${funcCount}`;

      // Indent each require call
      const body = newRequires
        .map(req => `  ${req};`)
        .join('\n');

      // Wrap in a function
      const fnCode = `\nfunction ${fnName}() {\n${body}\n}\n`;

      // Append to the file
      fs.appendFileSync(filePath, fnCode);
    } else if (!fs.existsSync(filePath)) {
      // If no new requires but file doesn't exist, write the base content
      fs.writeFileSync(filePath, fileContent, 'utf8');
    }

    return true;
  } catch (error) {
    logError(`Failed to write custom content to main-client.js: ${error.message}`);
    return false;
  }
}

/**
 * Writes custom content to the main-client.hmr.js entrypoint when in dev mode.
 * This helper function can be used to inject custom code into the client entry point.
 *
 * @returns {boolean} - True if the content was written successfully, false otherwise
 */
function writeMainClientEntryForHMR() {
  // Only write custom content in development mode
  if (!isMeteorAppDevelopment()) {
    return false;
  }

  const appDir = getMeteorAppDir();
  const filePath = `${appDir}/${RSPACK_BUILD_CONTEXT}/${addEnvSuffixToFilename('main-client.hmr.js')}`;

  try {
    // Ensure the file exists before writing to it
    if (!fs.existsSync(filePath)) {
      ensureModuleFilesExist();
    }
    // Write the custom content to the file
    fs.writeFileSync(filePath, `
// Main client entry point for RSPack to enable HMR

if (module.hot) {
  module.hot.accept();
}

import '../${getInitialEntrypoints().mainClient}'; 
`, 'utf8');
    return true;
  } catch (error) {
    logError(`Failed to write custom content to main-client.hmr.js: ${error.message}`);
    return false;
  }
}

module.exports = {
  getInitialEntrypoints,
  ensureRSPackBuildContextExists,
  ensureModuleFilesExist,
  writeMainClientContent,
  writeMainClientEntryForHMR
};
