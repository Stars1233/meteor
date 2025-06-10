/**
 * @module constants
 * @description Constants and global state keys for RSPack plugin
 */

/**
 * Default RSPack version to install if not found
 * @constant {string}
 */
const DEFAULT_RSPACK_VERSION = '1.3.15';

/**
 * Default React Refresh Plugin version to install if not found
 * @constant {string}
 */
const DEFAULT_REACT_REFRESH_PLUGIN_VERSION = '1.4.3';

/**
 * Global state keys used for storing and retrieving state across the application
 * @constant {Object}
 * @property {string} CLIENT_PROCESS - Key for storing the client process
 * @property {string} SERVER_PROCESS - Key for storing the server process
 * @property {string} RSPACK_INSTALLATION_CHECKED - Key for tracking if RSPack installation was checked
 * @property {string} REACT_REFRESH_PLUGIN_CHECKED - Key for tracking if React Refresh Plugin installation was checked
 * @property {string} IS_REACT_ENABLED - Key for tracking if React is enabled
 * @property {string} INITIAL_ENTRYPONTS - Key for storing initial entrypoints
 * @property {string} CLIENT_FIRST_COMPILE - Key for tracking client first compilation state
 * @property {string} SERVER_FIRST_COMPILE - Key for tracking server first compilation state
 */
const GLOBAL_STATE_KEYS = {
  CLIENT_PROCESS: 'rspack.clientProcess',
  SERVER_PROCESS: 'rspack.serverProcess',
  RSPACK_INSTALLATION_CHECKED: 'rspack.rspackInstallationChecked',
  REACT_REFRESH_PLUGIN_CHECKED: 'rspack.reactRefreshPluginChecked',
  IS_REACT_ENABLED: 'rspack.isReactEnabled',
  INITIAL_ENTRYPONTS: 'meteor.initialEntrypoints',
  CLIENT_FIRST_COMPILE: 'rspack.clientFirstCompile',
  SERVER_FIRST_COMPILE: 'rspack.serverFirstCompile',
};

/**
 * Directory name for RSPack build context
 * Can be overridden with RSPACK_BUILD_CONTEXT environment variable
 * @constant {string}
 */
const RSPACK_BUILD_CONTEXT = process.env.RSPACK_BUILD_CONTEXT || '_rspack';

/**
 * Directory name for RSPack assets context
 * Can be overridden with RSPACK_ASSETS_CONTEXT environment variable
 * @constant {string}
 */
const RSPACK_ASSETS_CONTEXT = process.env.RSPACK_ASSETS_CONTEXT || '_rspack-assets';

/**
 * Directory name for RSPack bundles context
 * Can be overridden with RSPACK_ASSETS_CONTEXT environment variable
 * @constant {string}
 */
const RSPACK_BUNDLES_CONTEXT = process.env.RSPACK_BUNDLES_CONTEXT || '_rspack-bundles';

/**
 * Regex pattern for hot update files
 * @constant {RegExp}
 */
const RSPACK_HOT_UPDATE_REGEX = /^\/(.+\.hot-update\.(?:json|js))$/;

/**
 * Regex pattern for rspack bundles
 * @constant {RegExp}
 */
const RSPACK_BUNDLES_REGEX = new RegExp(`^\/${RSPACK_BUNDLES_CONTEXT}\/(.+)$`);

/**
 * Regex pattern for rspack assets
 * @constant {RegExp}
 */
const RSPACK_ASSETS_REGEX = new RegExp(`^\/${RSPACK_ASSETS_CONTEXT}\/(.+)$`);

module.exports = {
  DEFAULT_RSPACK_VERSION,
  DEFAULT_REACT_REFRESH_PLUGIN_VERSION,
  GLOBAL_STATE_KEYS,
  RSPACK_BUILD_CONTEXT,
  RSPACK_ASSETS_CONTEXT,
  RSPACK_BUNDLES_CONTEXT,
  RSPACK_HOT_UPDATE_REGEX,
  RSPACK_BUNDLES_REGEX,
  RSPACK_ASSETS_REGEX,
};
