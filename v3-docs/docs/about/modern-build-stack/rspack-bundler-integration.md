# Rspack Bundler Integration

Rspack integration updates Meteor apps to modern bundling standards, offering faster builds, quicker reloads, smaller bundles, and a smoother development experience with built-in features and configurations.

In this setup, Rspack bundles your app code, while Meteor Bundler produces the final output, maintaining support for Meteor features like Atmosphere packages.

## Quick start

:::info
Starting with Meteor 3.4
:::

Add this Atmosphere package to your app:

``` bash
meteor add rspack
```

On first run, the package installs the required Rspack setup at the project level. It compiles your app code with Rspack to get the full benefit of this integration.

## Requirements

### Define the app’s entry points

Your app must define entry points for the Rspack integration to work. Entry points tell Rspack which files start execution on the client and server.

In Meteor, set this in `package.json`:

```json
{
  "meteor": {
    "mainModule": {
      "client": "client/main.js",
      "server": "server/main.js"
    }
  }
}
```

Check out the Meteor migration guide on describing entry points in your app.

### Remove nested imports

Your app code cannot use Meteor's specific nested imports (not to be confused with dynamic imports, which are supported). These are ES import statements placed inside conditions or functions.

``` javascript
if (condition) {
	import { a as b } from "./c"; // This is a nested import
	console.log(b);
}
```

[Refer to the Meteor migration guide](#nested-imports) to ensure your app code has no nested imports.

### Reserve a new build context

A Meteor-Rspack project reserves the folders `_build`, `public/_build-bundles`, and `public/_build-assets` to store intermediate bundles. These bundles are then passed to the Meteor bundler to complete the final app code. These folders are automatically prepared and cleared, as well as added to `.gitignore` if you are using Git.

You do not need to migrate your project for this, just make sure these folders are reserved for Meteor-Rspack integration. If you currently use them for another purpose, move that content elsewhere so they can be used for this integration. For now, there is no way to customize these folder names.

## Limitations

### No Blaze HMR support

Blaze templates build correctly with Rspack, but Meteor’s Hot Module Replacement (HMR) for Blaze is not available. Normally, Blaze HMR updates the UI instantly without reloading the whole page, keeping the current state (like form inputs or scroll position).

With Rspack, Blaze changes will instead trigger a full live reload. This reload is still very fast thanks to Rspack’s reduced rebuild time (about 97% reduction), but the page state will reset after each change. The limitation exists because Blaze’s HMR relies on Meteor’s internal mechanism, which is not yet compatible with Rspack.

This limitation only applies to Blaze. Any other modern project will work with HMR as soon as Rspack natively supports it, which is likely if it’s a modern library.

## Custom `rspack.config.js`

Meteor-Rspack projects can be customized using the `rspack.config.js` file, which is automatically available when installing the `rspack` package.

This file defines dynamic configurations, so you return the config from a resolved function.

```javascript
import { defineConfig } from '@meteorjs/rspack';
import { rspack } from '@rspack/core';
import HtmlRspackPlugin from 'html-rspack-plugin';
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';

/**
 * Example: Using different plugins for client and server builds
 *
 * - For client: Load Lodash automatically with ProvidePlugin
 * - For server: Add Node.js polyfills with NodePolyfillPlugin
 * - For both: Add progress plugin
 */
export default defineConfig(Meteor => {
  return {
    plugins: [
      Meteor.isClient && new rspack.ProvidePlugin({ _: 'lodash' }),
      Meteor.isServer && new NodePolyfillPlugin(),
      new rspack.ProgressPlugin()
    ].filter(Boolean)
  };
});
```

You can use flags to control the final configuration based on the environment. The available flags are passed in the `Meteor` parameter.

| Flag            | Type    | Description                                        |
| --------------- | ------- | -------------------------------------------------- |
| `isDevelopment` | boolean | True when running in development mode              |
| `isProduction`  | boolean | True when running in production mode               |
| `isClient`      | boolean | True when building or running client code          |
| `isServer`      | boolean | True when building or running server code          |
| `isTest`        | boolean | True when running in test mode                     |
| `isDebug`       | boolean | True when debug mode is enabled                    |
| `isRun`         | boolean | True when running the project with `meteor run`    |
| `isBuild`       | boolean | True when building the project with `meteor build` |

Some configurations in the Rspack config are reserved for the Meteor-Rspack setup to work, such as Rspack options inside the `entry` and `output` objects. These will trigger warnings if modified. All other settings can be overridden, giving you the flexibility to make any setup compatible with the modern bundler.

If you want to see the final Rspack config applying your overrides, you can enable verbose mode in the modern build stack.

```json
"meteor": {
  "modern": {
    "verbose": true
  }
}
```

## Migration Topics

### Entry Points

Meteor entry points allow a modular, modern, bundler-compliant structure for your Meteor app. Modern bundlers define entry points where the evaluation and bootstrap of your app begin. In Meteor, you can set these for both the client and server, and optionally for tests.

``` json
{
  "meteor": {
    "mainModule": {
      "client": "client/main.js",
      "server": "server/main.js"
    },
    "testModule": "tests.js"
  }
}
```

Learn more in [“Modular application structure” in Meteor](https://docs.meteor.com/packages/modules.html#modular-application-structure).

Ensure your app defines these entry files with the correct paths where each module is expected to load. Organize your app so the loading order of modules is clear.

Defining entry points improves performance even with the Meteor bundler, as Meteor stops scanning and eagerly loading unnecessary files. For Meteor-Rspack integration, this is required, since it does not support automatic code discovery for efficiency.

### Nested Imports

Nested imports are a feature of Meteor’s bundler, not supported in standard bundlers. Meteor introduced them during a time when bundling standards were still evolving and experimented with its own approach. This feature comes from the [`reify` module](https://github.com/benjamn/reify/tree/main) and works with Babel transpilation. SWC doesn't support them since they were never standardized.

:::warning
Don't confuse nested imports with standardized dynamic imports using `import()` in module blocks, these are supported.  
:::

Example with a nested import:

```javascript
// import { a as b } from "./c"; // root import
if (condition) {
  import { a as b } from "./c"; // nested import
  console.log(b);
}
```

For background, see: [Why nested import](https://github.com/benjamn/reify/blob/main/WHY_NEST_IMPORTS.md).

To use Rspack, migrate your nested imports to a standard form. To identify and fix nested imports in your project, [use verbose mode in Meteor 3.3’s modern transpiler](./meteor-bundler-optimizations.md#optimize-swc-and-handle-fallbacks). Enable it with:

```json  
"meteor": {
  "modern": {
    "verbose": true
  }
}
```

When you run your app, `[Transpiler]` logs will show each file. Focus on `(app)` files that fail with messages like:

`Error: 'import' and 'export' cannot be used outside of module code`

![](https://forums.meteor.com/uploads/default/original/3X/e/1/e1a2c285284f82ab736bcada647d88bd4fa8d3ec.png)

**Fix nested imports by moving them to the top of the file, or by replacing them with require or dynamic import.**

You can skip migrating `(package)` code with nested imports. Meteor packages are still handled by the Meteor bundler in Rspack integration, but your app code is fully delegated to Rspack and must use standard syntax.

Nested imports isn’t standard, most modern projects use other deferred loading methods. Let Rspack handle files to speed builds and enable modern features. The choice is up to the devs. Some Meteor devs use nested imports for valid reasons. You can opt out of Rspack and still get build speed gains from Meteor bundler optimizations.

:::info
With Meteor–Rspack integration, you can still use nested imports if they are defined in Meteor Atmosphere packages. These will be accepted without any breaking changes.
:::

## Troubleshotting

If you run into issues, try `meteor reset` or delete the `.meteor/local` and `_build` folders in the project root.

For help or to report issues, post on [GitHub](https://github.com/meteor/meteor/issues) or the [Meteor forums](https://forums.meteor.com). We’re focused on making Meteor faster and your feedback helps.

You can compare performance before and after enabling `modern` by running [`meteor profile`](../../cli/index.md#meteorprofile). Share your results to show progress to others.
