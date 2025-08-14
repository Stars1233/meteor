/**
 * @module processes
 * @description Functions for managing Rspack processes
 */
import { checkNpmDependencyExists } from 'meteor/tools-core/lib/npm';
import { RSPACK_DEVSERVER_PORT } from "./constants";

const {
  spawnProcess,
  stopProcess,
  isProcessRunning
} = require('meteor/tools-core/lib/process');

const {
  logError,
  logInfo,
} = require('meteor/tools-core/lib/log');

const {
  getMeteorAppDir,
  isMeteorAppTest,
  isMeteorAppDevelopment,
  isMeteorAppProduction,
  isMeteorAppDebug,
  isMeteorAppRun,
  isMeteorAppBuild,
  isMeteorBlazeProject,
  isMeteorBlazeHotProject,
  getMeteorInitialAppEntrypoints,
  isMeteorAppConfigModernVerbose,
} = require('meteor/tools-core/lib/meteor');

const {
  getGlobalState,
  setGlobalState
} = require('meteor/tools-core/lib/global-state');

const {
  GLOBAL_STATE_KEYS,
  RSPACK_BUNDLES_CONTEXT,
  RSPACK_ASSETS_CONTEXT,
  FILE_ROLE,
} = require('./constants');

const {
  getBuildFilePath,
  getBuildFileContent,
} = require('./build-context');

/**
 * Gets the appropriate config file name based on environment
 * @returns {string} The name of the Rspack config file
 */
export function getConfigFileName() {
  return `${process.cwd()}/node_modules/@meteorjs/rspack/rspack.config.js`;
}

/**
 * Gets the appropriate Rspack environment variables
 * @param {Object} options - Options for environment variables
 * @param {boolean} options.isClient - Whether this is for client-side build
 * @param {boolean} options.isServer - Whether this is for server-side build
 * @returns {string[]} Array of command line arguments for Rspack
 */
export function getRspackEnv({ isClient, isServer }) {
  const RSPACK_BUILD_CONTEXT = require('./constants').RSPACK_BUILD_CONTEXT;

  const initialEntrypoints = getMeteorInitialAppEntrypoints();
  const isTest = isMeteorAppTest();
  const isTestEager =
    initialEntrypoints.testModule == null &&
    initialEntrypoints.testClient == null &&
    initialEntrypoints.testServer == null;
  const isTestModule = initialEntrypoints.testModule != null || isTestEager;

  const module = isMeteorAppTest() ? { isTest: true } : { isMain: true };
  const env = isMeteorAppDevelopment()
    ? { isDevelopment: true }
    : { isProduction: true };
  const side = isTest && isTestModule ? { isTestModule: true } : isClient ? { isClient: true } : { isServer: true };
  const commandRole = isMeteorAppRun()
    ? { role: FILE_ROLE.run }
    : isMeteorAppBuild()
      ? { role: FILE_ROLE.build }
      : { role: FILE_ROLE.run };

  const entryKey = `${isTest && isTestModule ? 'test' : 'main'}${isClient ? 'Client' : 'Server'}`;
  const inputFilePath = isTest && isTestModule ? initialEntrypoints.testModule : initialEntrypoints[entryKey];
  const isTypescriptEnabled = inputFilePath?.endsWith('.ts') || inputFilePath?.endsWith('.tsx');
  const isTsxEnabled = inputFilePath?.endsWith('.tsx');
  const isJsxEnabled = inputFilePath?.endsWith('.jsx');

  const swcExternalHelpers = checkNpmDependencyExists('@swc/helpers');

  const pairs = [
    ['isDevelopment', isMeteorAppDevelopment()],
    ['isProduction', isMeteorAppProduction()],
    ['isDebug', isMeteorAppDebug()],
    ['isVerbose', isMeteorAppConfigModernVerbose()],
    ['isTest', isMeteorAppTest()],
    ['isTestModule', isTestModule],
    ['isTestEager', isTestEager],
    ['isRun', isMeteorAppRun()],
    ['isBuild', isMeteorAppBuild()],
    ['isClient', isClient],
    ['isServer', isServer],
    ['entryPath', getBuildFilePath({ ...module, ...env, ...side, role: FILE_ROLE.entry }) ],
    ['outputPath', getBuildFilePath({ ...module, ...env, ...side, role: FILE_ROLE.output }) ],
    ['outputFilename',
      getBuildFilePath({
        ...env,
        ...side,
        isMain: true,
        role: FILE_ROLE.output,
        onlyFilename: true,
      }),
    ],
    ['runPath', getBuildFilePath({ ...module, ...env, ...side, ...commandRole }) ],
    ['bannerOutput', JSON.stringify(getBuildFileContent({ ...module, ...env, ...side, role: FILE_ROLE.output }))],
    ['buildContext', RSPACK_BUILD_CONTEXT],
    ['bundlesContext', RSPACK_BUNDLES_CONTEXT],
    ['assetsContext', RSPACK_ASSETS_CONTEXT],
    ['isReactEnabled', process.env.METEOR_REACT_ENABLED],
    ['isBlazeEnabled', isMeteorBlazeProject()],
    ['isBlazeHotEnabled', isMeteorBlazeHotProject()],
    ['isTypescriptEnabled', isTypescriptEnabled],
    ['isTsxEnabled', isTsxEnabled],
    ['isJsxEnabled', isJsxEnabled],
    ['isCoffeescriptEnabled', process.env.METEOR_COFFEESCRIPT_ENABLED],
    ['swcExternalHelpers', swcExternalHelpers],
    ['devServerPort', RSPACK_DEVSERVER_PORT],
  ];
  return pairs.flatMap(([key, val]) => [
    '--env',
    `${key}=${val}`
  ]);
}

/**
 * Starts Rspack for client in serve mode
 * @param {Object} options - Options for client serve
 * @param {Function} options.onCompile - Callback function to be called when compilation is complete
 * @returns {Object} The client process object
 */
export function startRspackClientServe(options = {}) {
  const { onCompile } = options;
  // Get the current client process from global state
  const clientProcess = getGlobalState(GLOBAL_STATE_KEYS.CLIENT_PROCESS, null);

  // Skip if client process is already running
  if (clientProcess && isProcessRunning(clientProcess)) {
    return clientProcess;
  }

  const appDir = getMeteorAppDir();
  const configFile = getConfigFileName();
  const newClientProcess = spawnProcess(
    'npx',
    ['rspack', 'serve', '--config', configFile, ...getRspackEnv({ isClient: true, isServer: false })], {
      cwd: appDir,
      onStdout: (data) => {
        logInfo(`[Rspack Client] ${data}`);
        if (onCompile && data.trim().includes("compiled")) {
          onCompile(data);
        }
      },
      onStderr: (data) => {
        // Check if this is an EADDRINUSE error in development mode (which we want to completely ignore)
        if (isMeteorAppDevelopment() && data.includes('EADDRINUSE')) {
          logError(`[Rspack Client Error] ${data}`);
          return;
        }
        // Check if this is actually an informational message (like webpack-dev-server messages)
        if (data.includes('Loopback:') || data.includes('Project is running at:')) {
          logInfo(`[Rspack Client] ${data}`);
        } else {
          logError(`[Rspack Client Error] ${data}`);
        }
      },
      onError: (err) => {
        logError(`Rspack Error: ${err.message}`);
      }
    });

  // Store the new process in global state
  setGlobalState(GLOBAL_STATE_KEYS.CLIENT_PROCESS, newClientProcess);

  return newClientProcess;
}

/**
 * Starts Rspack for server in build --watch mode
 * @param {Object} options - Options for server watch
 * @param {Function} options.onCompile - Callback function to be called when compilation is complete
 * @returns {Object} The server process object
 */
export function startRspackServerWatch(options = {}) {
  const { onCompile } = options;
  // Get the current server process from global state
  const serverProcess = getGlobalState(GLOBAL_STATE_KEYS.SERVER_PROCESS, null);

  // Skip if server process is already running
  if (serverProcess && isProcessRunning(serverProcess)) {
    return serverProcess;
  }

  const appDir = getMeteorAppDir();
  const configFile = getConfigFileName();
  const newServerProcess = spawnProcess(
    'npx',
    ['rspack', 'build', '--watch', '--config', configFile, ...getRspackEnv({ isClient: false, isServer: true })], {
    cwd: appDir,
    onStdout: (data) => {
      logInfo(`[Rspack Server] ${data}`);
      if (onCompile && data.trim().includes("compiled")) {
        onCompile(data);
      }
    },
    onStderr: (data) => {
      // Check if this is actually an informational message (like webpack-dev-server messages)
      if (data.includes('Project is running at:')) {
        logInfo(`[Rspack Server] ${data}`);
      } else {
        logError(`[Rspack Server Error] ${data}`);
      }
    },
    onError: (err) => {
      logError(`Rspack Error: ${err.message}`);
    }
  });

  // Store the new process in global state
  setGlobalState(GLOBAL_STATE_KEYS.SERVER_PROCESS, newServerProcess);

  return newServerProcess;
}

/**
 * Runs Rspack build for both client and server without watch mode
 * @param {Object} options - Options for the build
 * @param {boolean} options.isClient - Whether this is a client build
 * @param {boolean} options.isServer - Whether this is a server build
 * @param {boolean} options.isTestModule - Whether this is a test module
 * @param {Function} options.onCompile - Callback function to be called when compilation is complete
 * @param {boolean} options.watch - Whether to run Rspack in watch mode
 * @returns {Promise<void>} A promise that resolves when the build is complete
 * @throws {Error} If the build process fails
 */
export async function runRspackBuild({ isClient, isServer, isTestModule, onCompile, watch, label = 'Build' } = {}) {
  const appDir = getMeteorAppDir();
  const configFile = getConfigFileName();

  const endpoint = isTestModule ? 'Module' : isClient ? 'Client' : 'Server';
  // Use a promise to ensure Meteor waits until Rspack finishes
  return new Promise((resolve, reject) => {
    spawnProcess(
      'npx',
      [
        'rspack',
        'build',
        '--config',
        configFile,
        ...(watch && ['--watch']) || [],
        ...getRspackEnv({ isClient, isServer, isTestModule }),
      ].filter(Boolean),
      {
      cwd: appDir,
      onStdout: (data) => {
        logInfo(`[Rspack ${label} ${endpoint}] ${data}`);
        if (onCompile && data.trim().includes("compiled")) {
          onCompile(data);
        }
      },
      onStderr: (data) => {
        // Check if this is actually an informational message (like webpack-dev-server messages)
        if (data.includes('Project is running at:')) {
          logInfo(`[Rspack ${label} ${endpoint}] ${data}`);
        } else {
          logError(`[Rspack ${label} Error ${endpoint}] ${data}`);
        }
      },
      onExit: (code) => {
        if (code === 0) {
          resolve();
        } else {
          const error = new Error(`Rspack ${label} failed in ${endpoint} with exit code ${code}`);
          logError(error.message);
          reject(error);
        }
      },
      onError: (err) => {
        logError(`Rspack ${label} ${endpoint} error: ${err.message}`);
        reject(err);
      }
    });
  });
}

/**
 * Cleans up processes when the plugin is stopped
 * Stops any running client and server processes and clears their global state
 * @returns {void}
 */
export function cleanup() {
  const clientProcess = getGlobalState(GLOBAL_STATE_KEYS.CLIENT_PROCESS, null);
  if (clientProcess) {
    stopProcess(clientProcess);
    setGlobalState(GLOBAL_STATE_KEYS.CLIENT_PROCESS, null);
  }

  const serverProcess = getGlobalState(GLOBAL_STATE_KEYS.SERVER_PROCESS, null);
  if (serverProcess) {
    stopProcess(serverProcess);
    setGlobalState(GLOBAL_STATE_KEYS.SERVER_PROCESS, null);
  }
}
