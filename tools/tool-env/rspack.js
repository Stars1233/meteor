// Helper functions for Rspack integration
const files = require('../fs/files');

// Get the build context from environment variable or use default "_build"
const rspackBuildContext = process.env.RSPACK_BUILD_CONTEXT || "_build";

// Get the assets context from environment variable or use default "_build-assets"
const rspackAssetsContext = process.env.RSPACK_ASSETS_CONTEXT || "_build-assets";

// Get the bundles context from environment variable or use default "_build-bundles"
const rspackBundlesContext = process.env.RSPACK_BUNDLES_CONTEXT || "_build-bundles";

// Cache the regex pattern for performance
const rspackFilePattern = new RegExp(`^${rspackBuildContext}\\/.*\\/[^\\/]*-rspack\\.js$`);

// Export the variables for use in other files
exports.rspackBuildContext = rspackBuildContext;
exports.rspackAssetsContext = rspackAssetsContext;
exports.rspackBundlesContext = rspackBundlesContext;
exports.rspackFilePattern = rspackFilePattern;

// Function to check if a file is a Rspack output file
exports.isRspackOutputFile = function(filePath) {
  return rspackFilePattern.test(filePath);
};

// Function to get the rspack resources contexts
exports.getRspackResourcesContexts = function() {
  return [
    rspackAssetsContext,
    rspackBundlesContext
  ];
};

// Function to get the rspack app contexts
exports.getRspackAppContexts = function(appDir) {
  const rspackResourcesContexts = exports.getRspackResourcesContexts();
  return [
    files.pathJoin(appDir, "node_modules", ".cache", "rspack"),
    files.pathJoin(appDir, rspackBuildContext),
    ...rspackResourcesContexts.reduce((arr, context) => [
      ...arr,
      files.pathJoin(appDir, `public/${context}`),
      files.pathJoin(appDir, `public/${context}`)
    ], [])
  ];
};
