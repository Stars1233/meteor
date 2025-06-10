import path from 'path';
import fs from 'fs';
import rspack, { DefinePlugin } from '@rspack/core';
import ReactRefreshPlugin from '@rspack/plugin-react-refresh';
import { merge } from 'webpack-merge';
import RequireExternalsPlugin from './RequireExternalsPlugin.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

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
function createSwcConfig({ isDev }) {
  return {
    test: /\.[jt]sx?$/,
    exclude: /node_modules|\.meteor\/local/,
    loader: 'builtin:swc-loader',
    options: {
      jsc: {
        baseUrl: process.cwd(),
        paths: { '/*': ['*'] },
        parser: { syntax: 'ecmascript', jsx: true },
        target: 'es2015',
        transform: {
          react: {
            development: isDev,
            refresh: isDev,
          },
        },
      },
    },
  };
}

// Watch options shared across both builds
const watchOptions = {
  ignored: [
    '**/main.html',
    '**/dist/**',
    '**/.meteor/local/**',
  ],
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
  const isReactEnabled = Meteor.isReactEnabled;
  const mode = isProd ? 'production' : 'development';

  // Determine entry points
  const clientEntry = Meteor.clientEntry
    ? path.resolve(process.cwd(), Meteor.clientEntry)
    : path.resolve(process.cwd(), 'ui/main.jsx');
  const serverEntry = Meteor.serverEntry
    ? path.resolve(process.cwd(), Meteor.serverEntry)
    : path.resolve(process.cwd(), 'api/main.js');

  // Determine output directories
  const clientOutputDir = path.resolve(process.cwd(), 'public');
  const serverOutputDir = path.resolve(process.cwd(), 'server');

  // Determine context for bundles and assets
  const buildContext = Meteor.buildContext || '_rspack';
  const bundlesContext = Meteor.bundlesContext || 'bundles';
  const assetsContext = Meteor.assetsContext || 'assets';

  if (Meteor.isDebug) {
    console.log('[i] Rspack mode:', mode);
    console.log('[i] Meteor flags:', Meteor);
  }

  const prefix = isTest ? 'test-' : 'main-';
  const suffix = isTest ? '' : isDev ? '.dev' : '.prod';
  // Base client config
  let clientConfig = {
    name: 'meteor-client',
    target: 'web',
    mode,
    entry: clientEntry,
    output: {
      path: clientOutputDir,
      filename: ({ chunk }) =>
        isDev ?
          `${prefix}client${suffix}.js` :`../${buildContext}/${prefix}client${suffix}.js`,
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
        createSwcConfig({ isDev })
      ],
    },
    resolve: { extensions: ['.js', '.jsx', '.json'] },
    externals: [/^(meteor.*|react$|react-dom$)/],
    plugins: [
      ...(isDev ? [
        ...(isReactEnabled ? [new ReactRefreshPlugin()] : []),
        new RequireExternalsPlugin({ buildContext }),
      ].filter(Boolean) : []),
      new DefinePlugin({
        'Meteor.isClient': JSON.stringify(true),
        'Meteor.isServer': JSON.stringify(false),
        'Meteor.isTest': JSON.stringify(isTest),
        'Meteor.isDevelopment': JSON.stringify(isDev),
        'Meteor.isProduction': JSON.stringify(isProd),
      }),
    ],
    watchOptions,
    devtool: isDev ? 'source-map' : 'hidden-source-map',
    ...(isDev && {
      devServer: {
        static: { directory: clientOutputDir, publicPath: '/__rspack__/' },
        hot: true,
        liveReload: true,
        port: 3005,
        devMiddleware: {
          writeToDisk: false,
        },
      },
    }),
  };

  // Base server config
  let serverConfig = {
    name: 'meteor-server',
    target: 'node',
    mode,
    entry: serverEntry,
    output: {
      path: serverOutputDir,
      filename: ({ chunk }) => `../${buildContext}/${prefix}server${suffix}.js`,
      libraryTarget: 'commonjs',
      chunkFilename: `${bundlesContext}/[id].[chunkhash].js`,
      assetModuleFilename: `${assetsContext}/[hash][ext][query]`,
    },
    optimization: { usedExports: true },
    module: {
      rules: [
        { test: /\.meteor\/local/, use: 'builtin:empty-loader', sideEffects: false },
        createSwcConfig({ isDev }),
      ],
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      modules: ['node_modules', path.resolve(process.cwd())],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    externals: [/^(meteor.*|react|react-dom)/],
    plugins: [
      new DefinePlugin({
        'Meteor.isClient': JSON.stringify(false),
        'Meteor.isServer': JSON.stringify(true),
        'Meteor.isTest': JSON.stringify(isTest),
        'Meteor.isDevelopment': JSON.stringify(isDev),
        'Meteor.isProduction': JSON.stringify(isProd),
      }),
    ],
    watchOptions,
    devtool: isDev ? 'source-map' : 'hidden-source-map',
    ...createCacheStrategy(mode),
  };

  // Load and apply project-level overrides for the selected build
  const projectConfigPath = path.resolve(process.cwd(), 'rspack.config.js');

  // Check if we're in a Meteor package directory by looking at the path
  const isMeteorPackageConfig = process.cwd().includes('/packages/rspack');
  if (fs.existsSync(projectConfigPath) && !isMeteorPackageConfig) {
    const projectConfig = require(projectConfigPath)?.default || require(projectConfigPath);

    const userConfig = typeof projectConfig === 'function'
      ? projectConfig(Meteor, argv)
      : projectConfig;

    if (Meteor.isClient) {
      clientConfig = merge(clientConfig, userConfig);
    }
    if (Meteor.isServer) {
      serverConfig = merge(serverConfig, userConfig);
    }
  }

  // Return the appropriate configuration
  if (isClient) {
    return [clientConfig];
  }
  // Meteor.isServer
  return [serverConfig];
}
