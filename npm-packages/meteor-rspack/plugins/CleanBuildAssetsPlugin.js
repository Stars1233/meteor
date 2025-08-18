import fs from 'fs/promises';
import path from 'path';

/**
 * Rspack plugin to clean and recreate build directories
 * before each compilation.
 *
 * Options:
 * - targets {string[]} : Directories to clean.
 *   Defaults:
 *     - public/_build-assets
 *     - public/_build-bundles
 *     - private/_build-assets
 * - verbose {boolean} : If true, logs cleaning operations. Default: false
 */
export default class CleanBuildAssetsPlugin {
  constructor(options = {}) {
    const defaults = [
      'public/_build-assets',
      'public/_build-bundles',
      'private/_build-assets',
    ];

    this.targets = Array.isArray(options.targets)
      ? options.targets
      : defaults;

    this.verbose = options.verbose || false;
  }

  apply(compiler) {
    compiler.hooks.beforeCompile.tapPromise(
      'CleanBuildAssetsPlugin',
      async () => {
        for (const target of this.targets) {
          const dir = path.resolve(compiler.context, target);
          try {
            await fs.rm(dir, { recursive: true, force: true });
            await fs.mkdir(dir, { recursive: true });
            if (this.verbose) {
              console.log(`[CleanBuildAssetsPlugin] Cleaned: ${dir}`);
            }
          } catch (err) {
            console.warn(
              `[CleanBuildAssetsPlugin] Failed to clean ${dir}:`,
              err.message
            );
          }
        }
      }
    )
  }
}
