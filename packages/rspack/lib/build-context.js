/**
 * @module build-context
 * @description Functions for managing build context and module files for Rspack plugin
 */

const fs = require('fs');
const path = require('path');

const { logError } = require('meteor/tools-core/lib/log');

const { capitalizeFirstLetter } = require('meteor/tools-core/lib/string');

const {
  getMeteorAppDir,
  getMeteorInitialAppEntrypoints,
  isMeteorAppDevelopment,
  isMeteorAppRun,
  isMeteorAppBuild,
  isMeteorBlazeProject,
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
  GLOBAL_STATE_KEYS,
  FILE_ROLE,
} = require('./constants');

/**
 * Gets entry points from Meteor configuration
 * Retrieves from global state if already stored, otherwise gets from Meteor
 * @returns {Object} Object containing entry points for client and server
 */
export function getInitialEntrypoints() {
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
 * Ensures the Rspack build context directory exists
 * Creates the directory if it doesn't exist and adds it to .gitignore
 * @returns {string} Path to the build context directory
 * @throws {Error} If directory creation fails
 */
export function ensureRspackBuildContextExists() {
  const appDir = getMeteorAppDir();
  const buildContextPath = path.join(appDir, RSPACK_BUILD_CONTEXT);

  if (!fs.existsSync(buildContextPath)) {
    try {
      fs.mkdirSync(buildContextPath, { recursive: true });
    } catch (error) {
      logError(`Failed to create Rspack build context directory: ${error.message}`);
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
    'Meteor-Rspack build context directories',
  );

  return buildContextPath;
}

/**
 * Ensures module files exist in the build context directory
 * Creates default module files if they don't exist
 * @returns {void}
 */
export function ensureModuleFilesExist() {
  const appDir = getMeteorAppDir();

  const env = isMeteorAppDevelopment() ? { isDevelopment: true } : { isProduction: true };
  const commandRole = isMeteorAppRun()
    ? { role: FILE_ROLE.run }
    : isMeteorAppBuild()
    ? { role: FILE_ROLE.build }
    : { role: FILE_ROLE.run };
  const initialEntrypoints = getInitialEntrypoints();
  const mainClientFiles = {
    entryFile: initialEntrypoints.mainClient || '',
    outputFile: getBuildFilePath({ isMain: true, isClient: true, ...env, role: FILE_ROLE.output, onlyFilename: true }),
  };
  const mainServerFiles = {
    entryFile: initialEntrypoints.mainServer || '',
    outputFile: getBuildFilePath({ isMain: true, isServer: true, ...env, role: FILE_ROLE.output, onlyFilename: true }),
  };
  const isTestModule = initialEntrypoints.testModule != null;
  const testModuleFiles = {
    entryFile: initialEntrypoints.testModule || '',
    outputFile: getBuildFilePath({ isTest: true, isTestModule: true, role: FILE_ROLE.output, onlyFilename: true }),
  };
  const testClientFiles = isTestModule ? null : {
    entryFile: initialEntrypoints.testClient || '',
    outputFile: getBuildFilePath({ isTest: true, isClient: true, role: FILE_ROLE.output, onlyFilename: true }),
  };
  const testServerFiles = isTestModule ? null : {
    entryFile: initialEntrypoints.testServer || '',
    outputFile: getBuildFilePath({ isTest: true, isServer: true, role: FILE_ROLE.output, onlyFilename: true }),
  };

  const moduleFiles = {
    /* Main module files for client and server */
    [getBuildFilePath({ isMain: true, isClient: true, ...env, ...commandRole })]:
      getBuildFileContent({ isMain: true, isClient: true, ...env, ...commandRole, ...mainClientFiles }),
    [getBuildFilePath({ isMain: true, isClient: true, ...env, role: FILE_ROLE.entry })]:
      getBuildFileContent({ isMain: true, isClient: true, ...env, role: FILE_ROLE.entry, ...mainClientFiles }),
    [getBuildFilePath({ isMain: true, isClient: true, ...env, role: FILE_ROLE.output })]:
      getBuildFileContent({ isMain: true, isClient: true, ...env, role: FILE_ROLE.output, ...mainClientFiles }),
    [getBuildFilePath({ isMain: true, isServer: true, ...env, ...commandRole })]:
      getBuildFileContent({ isMain: true, isServer: true, ...env, ...commandRole, ...mainServerFiles }),
    [getBuildFilePath({ isMain: true, isServer: true, ...env, role: FILE_ROLE.entry })]:
      getBuildFileContent({ isMain: true, isServer: true, ...env, role: FILE_ROLE.entry, ...mainServerFiles }),
    [getBuildFilePath({ isMain: true, isServer: true, ...env, role: FILE_ROLE.output })]:
      getBuildFileContent({ isMain: true, isServer: true, ...env, role: FILE_ROLE.output, ...mainServerFiles }),
    /* Test module files when just test module or test module files for client and server are present */
    ...(isTestModule && {
      [getBuildFilePath({ isTest: true, isTestModule: true, ...commandRole })]:
        getBuildFileContent({ isTest: true, isTestModule: true, ...commandRole, ...testModuleFiles }),
      [getBuildFilePath({ isTest: true, isTestModule: true, role: FILE_ROLE.entry })]:
        getBuildFileContent({ isTest: true, isTestModule: true, role: FILE_ROLE.entry, ...testModuleFiles }),
      [getBuildFilePath({ isTest: true, isTestModule: true, role: FILE_ROLE.output })]:
        getBuildFileContent({ isTest: true, isTestModule: true, role: FILE_ROLE.output, ...testModuleFiles }),
    } || {
      [getBuildFilePath({ isTest: true, isClient: true, ...commandRole })]:
        getBuildFileContent({ isTest: true, isClient: true, ...commandRole, ...testClientFiles }),
      [getBuildFilePath({ isTest: true, isClient: true, role: FILE_ROLE.entry })]:
        getBuildFileContent({ isTest: true, isClient: true, role: FILE_ROLE.entry, ...testClientFiles }),
      [getBuildFilePath({ isTest: true, isClient: true, role: FILE_ROLE.output })]:
        getBuildFileContent({ isTest: true, isClient: true, role: FILE_ROLE.output, ...testClientFiles }),
      [getBuildFilePath({ isTest: true, isServer: true, ...commandRole })]:
        getBuildFileContent({ isTest: true, isServer: true, ...commandRole, ...testServerFiles }),
      [getBuildFilePath({ isTest: true, isServer: true, role: FILE_ROLE.entry })]:
        getBuildFileContent({ isTest: true, isServer: true, role: FILE_ROLE.entry, ...testServerFiles }),
      [getBuildFilePath({ isTest: true, isServer: true, role: FILE_ROLE.output })]:
        getBuildFileContent({ isTest: true, isServer: true, role: FILE_ROLE.output, ...testServerFiles }),
    }),
  };

  Object.entries(moduleFiles).forEach(([filename, defaultContent]) => {
    // 1. Build full path and ensure directory exists
    const filePath = path.join(appDir, RSPACK_BUILD_CONTEXT, filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        logError(`Failed to create directory ${dir}: ${err.message}`);
        return; // stop here if we can’t make the folder
      }
    }

    // 2. If the file exists, check its contents
    if (fs.existsSync(filePath)) {
      let existing;
      try {
        existing = fs.readFileSync(filePath, 'utf8');
      } catch (err) {
        logError(`Failed to read existing file ${filename}: ${err.message}`);
        return;
      }

      // 3. If it doesn't already start with the new defaultContent, overwrite it
      if (!existing.includes(defaultContent)) {
        try {
          fs.writeFileSync(filePath, defaultContent, 'utf8');
        } catch (err) {
          logError(`Failed to rewrite module file ${filename}: ${err.message}`);
        }
      }

      // 4. If the file doesn't exist at all, write it for the first time
    } else {
      try {
        fs.writeFileSync(filePath, defaultContent, 'utf8');
      } catch (err) {
        logError(`Failed to create module file ${filename}: ${err.message}`);
      }
    }
  });
}

export function getBuildFilePath(config) {
  const module = config?.isTest ? 'test' : config?.isMain ? 'main' : '';
  const side = config?.isTestModule ? 'test' : config?.isServer ? 'server' : config?.isClient ? 'client' : '';
  const env = config?.isTest
    ? ''
    : config?.isDevelopment
    ? 'dev'
    : config?.isProduction
    ? 'prod'
    : '';
  const role = [FILE_ROLE.run, FILE_ROLE.build].includes(config?.role)
    ? 'meteor'
    : [FILE_ROLE.output].includes(config?.role)
    ? 'rspack'
    : config?.role;
  const extension = config?.extension || 'js';
  const onlyFilename = config?.onlyFilename;
  const filename = `${side}-${role}.${extension}`;
  return onlyFilename
    ? filename
    : `${module}${env ? `-${env}` : ''}/${filename}`;
}

export function getBuildFileContent(config) {
  const module = config?.isTest ? 'test' : config?.isMain ? 'main' : '';
  const side = config?.isTestModule ? 'test' : config?.isServer ? 'server' : config?.isClient ? 'client' : '';
  const env = config?.isDevelopment ? 'development' : config?.isProduction ? 'production' : '';
  const role = config?.role;

  const banner = [FILE_ROLE.run, FILE_ROLE.build].includes(role) ? `/**
 * --------------------------------------------------------------------------
 * ☄️ Meteor ${capitalizeFirstLetter(side)} App (${capitalizeFirstLetter(env || module)})
 * --------------------------------------------------------------------------
 * Describe the Meteor app for the ${side} side.
 */` : `/**
 * --------------------------------------------------------------------------
 * ⚡ Rspack ${capitalizeFirstLetter(side)} ${
        role === FILE_ROLE.output ? 'App' : capitalizeFirstLetter(role)
      } (${capitalizeFirstLetter(env || module)})
 * --------------------------------------------------------------------------
 * Describe the Rspack ${side} ${
   config?.role === FILE_ROLE.output ? 'app' : role
 }${
        config?.role === FILE_ROLE.entry ? ' to compile the Rspack app' : ''
      }.
 */`;

  const hmr = role === FILE_ROLE.entry && config?.isClient && !config?.isTest
    ? `/* Enables HMR */
if (module.hot) {
  module.hot.accept();
}` : '';

  const importContent = config?.entryFile && role === FILE_ROLE.entry
    ? `/* Link to ☄️ Meteor ${capitalizeFirstLetter(side)} Entry */
import '../../${config?.entryFile}';`
      : config?.outputFile &&
        (role === FILE_ROLE.build || config?.isProduction ||
          (role === FILE_ROLE.run && (config?.isServer || config?.isTest)))
      ? `/* Link to ⚡ Rspack ${capitalizeFirstLetter(side)} App */
${
  (isMeteorBlazeProject() && config?.isClient && '// In Blaze, import happens last so HTML files preload first') ||
  `import './${config?.outputFile || ''}';`
}`
      : role === FILE_ROLE.run && config?.isServer && !config?.isTest
      ? '/* No link to ☄️ Meteor Server App as served by HMR server */'
      : role === FILE_ROLE.run && config?.isClient && !config?.isTest
      ? '/* No link to ⚡ Rspack Client App as served by HMR server */'
      : role === FILE_ROLE.output && config?.isClient && !config?.isTest
      ? '/* No code generated as served by HMR server */'
      : role === FILE_ROLE.output && config?.isServer
      ? '/* Code generated */'
      : role === FILE_ROLE.output && config?.isTest
      ? '/* Code generated */'
      : '';

  return `${banner}
${hmr && `
${hmr}
` || ''}
${importContent}
`;
}

/**
 * Ensures the rspack.config.js file exists at the project level
 * Creates the file if it doesn't exist with the required template
 * @returns {string} Path to the rspack.config.js file
 */
export function ensureRspackConfigExists() {
  const appDir = getMeteorAppDir();
  const configPath = path.join(appDir, 'rspack.config.js');

  const configTemplate = `import { defineConfig } from '@meteorjs/rspack';

/**
 * Rspack configuration for Meteor projects.
 *
 * Provides typed flags on the \`Meteor\` object, such as:
 * - \`Meteor.isClient\` / \`Meteor.isServer\`
 * - \`Meteor.isDevelopment\` / \`Meteor.isProduction\`
 * - …and other flags available
 *
 * Use these flags to adjust your build settings based on environment.
 */
export default defineConfig(Meteor => {
  return {};
});
`;

  if (!fs.existsSync(configPath)) {
    try {
      fs.writeFileSync(configPath, configTemplate, 'utf8');
    } catch (error) {
      logError(`Failed to create rspack.config.js file: ${error.message}`);
      throw error;
    }
  }

  return configPath;
}
