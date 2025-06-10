/**
 * @module config
 * @description Functions for configuring Meteor for RSPack
 */

const {
  getMeteorAppFilesAndFolders,
  setMeteorAppIgnore,
  setMeteorAppEntrypoints,
  setMeteorAppCustomScriptUrl,
  addEnvSuffixToFilename,
  isMeteorAppDevelopment,
} = require('meteor/tools-core/lib/meteor');

const {
  RSPACK_BUILD_CONTEXT
} = require('./constants');

const {
  ensureModuleFilesExist,
  writeMainClientContent,
  writeMainClientEntryForHMR
} = require('./build-context');

/**
 * Configures Meteor settings for RSPack
 * Sets up file ignores, entry points, and custom script URL
 * Creates necessary module files and writes content to them
 * @returns {void}
 */
function configureMeteorForRSPack() {
  // Ignore node_modules to prevent Meteor from processing them
  const projectFilesAndFolders = getMeteorAppFilesAndFolders({ recursive: false });
  const foldersToIgnore = [
    'node_modules/**',
      ...projectFilesAndFolders.directories
      .filter(dir => !['public', 'private', '.meteor', RSPACK_BUILD_CONTEXT].includes(dir))
      .map(dir => `${dir}/**`),
      ...projectFilesAndFolders.directories
        .filter(dir => !['public', 'private', '.meteor', RSPACK_BUILD_CONTEXT].includes(dir))
        .map(dir => `!${dir}/**/*.html`),
  ];
  const filesToIgnore = [
    ...projectFilesAndFolders.files
      .filter(file => !['package.json', '.meteorignore'].includes(file)),
  ];
  const meteorAppIgnores = `${foldersToIgnore.join(' ')} ${filesToIgnore.join(' ')}`;
  setMeteorAppIgnore(meteorAppIgnores);

  const mainClientModule = addEnvSuffixToFilename(`${RSPACK_BUILD_CONTEXT}/main-client.js`);
  const mainServerModule = addEnvSuffixToFilename(`${RSPACK_BUILD_CONTEXT}/main-server.js`);
  const testClientModule = `${RSPACK_BUILD_CONTEXT}/test-client.js`;
  const testServerModule = `${RSPACK_BUILD_CONTEXT}/test-server.js`;
  // Set entry points in environment variables if they exist
  setMeteorAppEntrypoints({
    mainClient: mainClientModule,
    mainServer: mainServerModule,
    testClient: testClientModule,
    testServer: testServerModule,
  });

  // Ensure module files exist
  ensureModuleFilesExist();

  // Write content to module files
  if (isMeteorAppDevelopment()) {
    writeMainClientContent();
    writeMainClientEntryForHMR();
    setMeteorAppCustomScriptUrl(addEnvSuffixToFilename('/__rspack__/main-client.js'));
  }
}

module.exports = {
  configureMeteorForRSPack
};
