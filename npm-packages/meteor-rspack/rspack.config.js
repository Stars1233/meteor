import { DefinePlugin, BannerPlugin } from '@rspack/core';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { merge } from 'webpack-merge';
import { inspect } from "node:util";

import { RequireExternalsPlugin } from './plugins/RequireExtenalsPlugin.js';
import { getMeteorAppSwcConfig } from "./lib/swc.js";
import { mergeSplitOverlap } from './lib/mergeRulesSplitOverlap.js';

const require = createRequire(import.meta.url);

// Safe require that doesn't throw if the module isn't found
function safeRequire(moduleName) {
  try {
    return require(moduleName);
  } catch (error) {
    if (
      error.code === 'MODULE_NOT_FOUND' &&
      error.message.includes(moduleName)
    ) {
      return null;
    }
    throw error; // rethrow if it's a different error
  }
}

// Persistent filesystem cache strategy
function createCacheStrategy(mode) {
  return {
    cache: true,
    experiments: {
      cache: {
        version: `swc-${mode}`,
        type: 'persistent',
        storage: {
          type: 'filesystem',
          directory: 'node_modules/.cache/rspack',
        },
      },
    },
  };
}

// SWC loader rule (JSX/JS)
function createSwcConfig({ isTypescriptEnabled, isJsxEnabled, isTsxEnabled, externalHelpers, isDevEnvironment }) {
  const defaultConfig = {
    jsc: {
      baseUrl: process.cwd(),
      paths: { '/*': ['*'] },
      parser: {
        syntax: isTypescriptEnabled ? 'typescript' : 'ecmascript',
        ...(isTsxEnabled && { tsx: true }),
        ...(isJsxEnabled && { jsx: true }),
      },
      target: 'es2015',
      transform: {
        react: {
          development: isDevEnvironment,
          refresh: isDevEnvironment,
        },
      },
      externalHelpers,
    },
  };
  const customConfig = getMeteorAppSwcConfig() || {};
  const swcConfig = merge(defaultConfig, customConfig);
  return {
    test: /\.(?:[mc]?js|jsx|[mc]?ts|tsx)$/i,
    exclude: /node_modules|\.meteor\/local/,
    loader: 'builtin:swc-loader',
    options: swcConfig,
  };
}

// Coffeescript rule
function createCoffeescriptConfig({ swcConfig }) {
  return {
    test: /\.coffee$/i,
    use: [
      {
        loader: 'swc-loader',
        options: swcConfig,
      },
      {
        loader: 'coffee-loader',
      },
    ],
  };
}

// Watch options shared across both builds
const defaultWatchOptions = {
  ignored: ['**/.meteor/local/**', '**/dist/**'],
};

/**
 * @param {{ isClient: boolean; isServer: boolean; isDevelopment?: boolean; isProduction?: boolean; isTest?: boolean }} Meteor
 * @param {{ mode?: string; clientEntry?: string; serverEntry?: string; clientOutputFolder?: string; serverOutputFolder?: string; bundlesContext?: string; assetsContext?: string; serverAssetsContext?: string }} argv
 * @returns {import('@rspack/cli').Configuration[]}
 */
export default function (inMeteor = {}, argv = {}) {
  // Transform Meteor env properties to proper boolean values
  const Meteor = { ...inMeteor };
  // Convert string boolean values to actual booleans
  for (const key in Meteor) {
    if (Meteor[key] === 'true' || Meteor[key] === true) {
      Meteor[key] = true;
    } else if (Meteor[key] === 'false' || Meteor[key] === false) {
      Meteor[key] = false;
    }
  }

  const isProd = Meteor.isProduction || argv.mode === 'production';
  const isDev = Meteor.isDevelopment || !isProd;
  const isTest = Meteor.isTest;
  const isClient = Meteor.isClient;
  const isRun = Meteor.isRun;
  const isReactEnabled = Meteor.isReactEnabled;
  const isTestModule = Meteor.isTestModule;
  const isTestEager = Meteor.isTestEager;
  const swcExternalHelpers = Meteor.swcExternalHelpers;
  const mode = isProd ? 'production' : 'development';

  const isTypescriptEnabled = Meteor.isTypescriptEnabled || false;
  const isJsxEnabled =
    Meteor.isJsxEnabled || (!isTypescriptEnabled && isReactEnabled) || false;
  const isTsxEnabled =
    Meteor.isTsxEnabled || (isTypescriptEnabled && isReactEnabled) || false;

  const isCoffeescriptEnabled = Meteor.isCoffeescriptEnabled || false;

  // Determine entry points
  const entryPath = Meteor.entryPath;

  // Determine output points
  const outputPath = Meteor.outputPath;
  const outputFilename = Meteor.outputFilename;

  // Determine run point
  const runPath = Meteor.runPath;

  // Determine banner
  const bannerOutput = JSON.parse(Meteor.bannerOutput || '');

  // Determine output directories
  const clientOutputDir = path.resolve(process.cwd(), 'public');
  const serverOutputDir = path.resolve(process.cwd(), 'private');

  // Determine context for bundles and assets
  const buildContext = Meteor.buildContext || '_build';
  const bundlesContext = Meteor.bundlesContext || 'bundles';
  const assetsContext = Meteor.assetsContext || 'assets';

  // Set watch options
  const watchOptions = {
    ...defaultWatchOptions,
    ...isTestEager && {
      ignored: [
        ...defaultWatchOptions.ignored,
        '**/_build/**',
        '**/.meteor/local/**',
        '**/node_modules/**',
      ],
    },
  };

  if (Meteor.isDebug || Meteor.isVerbose) {
    console.log('[i] Rspack mode:', mode);
    console.log('[i] Meteor flags:', Meteor);
  }

  const isDevEnvironment = isRun && isDev && !isTest;
  const swcConfigRule = createSwcConfig({
    isTypescriptEnabled,
    isJsxEnabled,
    isTsxEnabled,
    externalHelpers: swcExternalHelpers,
    isDevEnvironment,
  });
  const externals = [
    /^meteor.*/,
    ...(isReactEnabled ? [/^react$/, /^react-dom$/] : []),
  ];
  const alias = {
    '/': path.resolve(process.cwd()),
  };
  const extensions = [
    ...(isCoffeescriptEnabled ? ['.coffee'] : []),
    '.ts',
    '.tsx',
    '.mts',
    '.cts',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.json',
    '.wasm',
  ];
  const extraRules = [
    ...(isCoffeescriptEnabled
      ? [createCoffeescriptConfig({ swcConfig: swcConfigRule?.options })]
      : []),
  ];

  const reactRefreshModule = isReactEnabled ? safeRequire('@rspack/plugin-react-refresh') : null;

  const requireExternalsPlugin = new RequireExternalsPlugin({
    filePath: path.join(buildContext, runPath),
    ...(Meteor.isBlazeEnabled && {
      externals: /\.html$/,
      isEagerImport: (module) => module.endsWith('.html'),
      ...isProd && {
        lastImports: [`./${outputFilename}`],
      },
    }),
    enableGlobalPolyfill: isDevEnvironment,
  });

  const clientNameConfig = `[${isTest && 'test-' || ''}${isTestModule && 'module' || 'client'}-rspack]`;
  // Base client config
  let clientConfig = {
    name: clientNameConfig,
    target: 'web',
    mode: 'development',
    entry: path.resolve(process.cwd(), buildContext, entryPath),
    output: {
      path: clientOutputDir,
      filename: () =>
        isDevEnvironment ? outputFilename : `../${buildContext}/${outputPath}`,
      libraryTarget: 'commonjs',
      publicPath: '/',
      chunkFilename: `${bundlesContext}/[id].[chunkhash].js`,
      assetModuleFilename: `${assetsContext}/[hash][ext][query]`,
    },
    optimization: {
      usedExports: true,
      splitChunks: { chunks: 'async' },
    },
    module: {
      rules: [
        swcConfigRule,
        ...(Meteor.isBlazeEnabled
          ? [
              {
                test: /\.html$/i,
                loader: 'ignore-loader',
              },
            ]
          : []),
        ...extraRules,
      ],
    },
    resolve: { extensions, alias },
    externals,
    plugins: [
      ...[
        ...(isReactEnabled && reactRefreshModule && isDevEnvironment
          ? [new reactRefreshModule()]
          : []),
        requireExternalsPlugin,
      ].filter(Boolean),
      new DefinePlugin({
        'Meteor.isClient': JSON.stringify(true),
        'Meteor.isServer': JSON.stringify(false),
        'Meteor.isTest': JSON.stringify(isTest),
        'Meteor.isDevelopment': JSON.stringify(isDev),
        'Meteor.isProduction': JSON.stringify(isProd),
      }),
      new BannerPlugin({
        banner: bannerOutput,
        entryOnly: true,
      }),
    ],
    watchOptions,
    devtool: isDevEnvironment || isTest ? 'source-map' : 'hidden-source-map',
    ...(isDevEnvironment && {
      devServer: {
        static: { directory: clientOutputDir, publicPath: '/__rspack__/' },
        hot: true,
        liveReload: true,
        ...(Meteor.isBlazeEnabled && { hot: false }),
        port: Meteor.devServerPort || 8080,
        devMiddleware: {
          writeToDisk: false,
        },
      },
    }),
  };

  const serverNameConfig = `[${isTest && 'test-' || ''}${isTestModule && 'module' || 'server'}-rspack]`;
  // Base server config
  let serverConfig = {
    name: serverNameConfig,
    target: 'node',
    mode,
    entry: isTestEager
      ? "node_modules/@meteorjs/rspack/entries/eager-tests.js"
      : path.resolve(process.cwd(), buildContext, entryPath),
    output: {
      path: serverOutputDir,
      filename: () => `../${buildContext}/${outputPath}`,
      libraryTarget: 'commonjs',
      chunkFilename: `${bundlesContext}/[id].[chunkhash].js`,
      assetModuleFilename: `${assetsContext}/[hash][ext][query]`,
    },
    optimization: { usedExports: true },
    module: {
      rules: [swcConfigRule, ...extraRules],
      parser: {
        javascript: {
          // Dynamic imports on the server are treated as bundled in the same chunk
          dynamicImportMode: 'eager',
        },
      },
    },
    resolve: {
      extensions,
      alias,
      modules: ['node_modules', path.resolve(process.cwd())],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    externals,
    plugins: [
      new DefinePlugin(
        isTestModule || isTestEager
          ? {
              "Meteor.isTest": JSON.stringify(isTest),
              "Meteor.isDevelopment": JSON.stringify(isDev),
            }
          : {
              "Meteor.isClient": JSON.stringify(true),
              "Meteor.isServer": JSON.stringify(false),
              "Meteor.isTest": JSON.stringify(isTest),
              "Meteor.isDevelopment": JSON.stringify(isDev),
              "Meteor.isProduction": JSON.stringify(isProd),
            }
      ),
      new BannerPlugin({
        banner: bannerOutput,
        entryOnly: true,
      }),
      isTestModule && requireExternalsPlugin,
    ],
    watchOptions,
    devtool: isDevEnvironment || isTest ? 'source-map' : 'hidden-source-map',
    ...((isDevEnvironment || isTest && !isTestEager) &&
      createCacheStrategy(mode)
    ),
  };

  // Load and apply project-level overrides for the selected build
  const projectConfigPath = path.resolve(process.cwd(), 'rspack.config.js');

  // Check if we're in a Meteor package directory by looking at the path
  const isMeteorPackageConfig = process.cwd().includes('/packages/rspack');
  if (fs.existsSync(projectConfigPath) && !isMeteorPackageConfig) {
    const projectConfig =
      require(projectConfigPath)?.default || require(projectConfigPath);

    const userConfig =
      typeof projectConfig === 'function'
        ? projectConfig(Meteor, argv)
        : projectConfig;

    if (Meteor.isClient) {
      clientConfig = mergeSplitOverlap(clientConfig, userConfig);
    }
    if (Meteor.isServer) {
      serverConfig = mergeSplitOverlap(serverConfig, userConfig);
    }
  }

  const config = isClient ? clientConfig : serverConfig;

  if (Meteor.isDebug || Meteor.isVerbose) {
    console.log('Config:', inspect(config, { depth: null, colors: true }));
  }

  return [config];
}
