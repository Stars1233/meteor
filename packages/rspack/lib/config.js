/**
 * @module config
 * @description Functions for configuring Meteor for RSPack
 */
import { getInitialEntrypoints } from "./build-context";

const {
  getMeteorAppFilesAndFolders,
  setMeteorAppIgnore,
  setMeteorAppEntrypoints,
  setMeteorAppCustomScriptUrl,
  isMeteorAppDevelopment,
  isMeteorAppRun,
  isMeteorAppBuild,
} = require('meteor/tools-core/lib/meteor');

const {
  RSPACK_BUILD_CONTEXT,
  FILE_ROLE,
} = require('./constants');

const {
  ensureModuleFilesExist,
  getBuildFilePath,
} = require('./build-context');

/**
 * Configures Meteor settings for RSPack
 * Sets up file ignores, entry points, and custom script URL
 * Creates necessary module files and writes content to them
 * @returns {void}
 */
export function configureMeteorForRSPack() {
  const initialEntrypoints = getInitialEntrypoints();

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

  const env = isMeteorAppDevelopment()
    ? { isDevelopment: true }
    : { isProduction: true };
  const commandRole = isMeteorAppRun()
    ? { role: FILE_ROLE.run }
    : isMeteorAppBuild()
    ? { role: FILE_ROLE.build }
    : { role: FILE_ROLE.run };
  const mainClientModule = getBuildFilePath({ isMain: true, ...env, ...commandRole, isClient: true });
  const mainServerModule = getBuildFilePath({ isMain: true, ...env, ...commandRole, isServer: true });
  const testClientModule = getBuildFilePath({ isTest: true, ...env, ...commandRole, isClient: true });
  const isTestModule = initialEntrypoints.testModule != null;
  const testServerModule = getBuildFilePath({ isTest: true, ...env, ...commandRole, isTestModule, isServer: true });

  const appEntrypoints = {
    mainClient: `${RSPACK_BUILD_CONTEXT}/${mainClientModule}`,
    mainServer: `${RSPACK_BUILD_CONTEXT}/${mainServerModule}`,
    ...(isTestModule && {
      testModule: `${RSPACK_BUILD_CONTEXT}/${testServerModule}`,
    } || {
      testClient: `${RSPACK_BUILD_CONTEXT}/${testClientModule}`,
      testServer: `${RSPACK_BUILD_CONTEXT}/${testServerModule}`,
    }),
  };
  // Set entry points in environment variables if they exist
  setMeteorAppEntrypoints(appEntrypoints);

  // Ensure module files exist
  ensureModuleFilesExist();

  // Write content to module files
  if (isMeteorAppRun()) {
    setMeteorAppCustomScriptUrl(
      `/__rspack__/${getBuildFilePath({ ...env, isMain: true, isClient: true, role: FILE_ROLE.output, onlyFilename: true })}`,
    );
  }
}
