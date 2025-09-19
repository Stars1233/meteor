var fs = require('fs');
var path = require('path');

// Cleans an entry from wildcard patterns (*/**)
function cleanWildcardEntry(entry) {
  // If it's an extension pattern like *.ext, skip it
  if (entry.match(/\*\.[^\/]+$/)) {
    return null;
  }

  // Handle patterns like my-folder/**/* by extracting the folder part
  if (entry.includes('/**/')) {
    const folderContext = entry.split('/**/')[0].replace(/\/+$/, '');
    if (folderContext) {
      return folderContext;
    }
  }

  // Otherwise, extract the folder context by removing the wildcard part
  if (entry.includes('*')) {
    const folderContext = entry.split('*')[0].replace(/\/+$/, '');
    if (folderContext) {
      return folderContext;
    }
    return null;
  }

  return entry;
}

/**
 * Reads the .meteorignore file from the given project directory and returns
 * the parsed entries.
 *
 * @param {string} projectDir - The project directory path
 * @returns {Object} - Object with rootFolders and nestedFolders arrays
 */
const getMeteorIgnoreEntries = function (projectDir) {
  const meteorIgnorePath = path.join(projectDir, '.meteorignore');

  // Check if .meteorignore file exists
  let entries = [];
  try {
    const fileContent = fs.readFileSync(meteorIgnorePath, 'utf8');

    // Process each line in the file
    entries = fileContent.split(/\r?\n/).filter(line => {
      // Trim the line
      const trimmedLine = line.trim();
      // Skip empty lines, comments, and negation entries (starting with !)
      return trimmedLine !== '' && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('!');
    }).map(line => line.trim()); // Ensure all lines are trimmed

    // Clean all entries from wildcard patterns (*/** parts)
    entries = entries.map(entry => {
      return cleanWildcardEntry(entry);
    }).filter(entry => entry !== null);

    // Separate entries into rootFolders and nestedFolders
    const rootFolders = [];
    const nestedFolders = [];

    entries.forEach(entry => {
      // If entry starts with / or ./, it's a root folder
      if (entry.startsWith('/') || entry.startsWith('./')) {
        rootFolders.push(entry);
      } else {
        // Otherwise, it's a nested folder
        nestedFolders.push(entry);
      }
    });

    return { rootFolders, nestedFolders };
  } catch (e) {
    // If the file doesn't exist or can't be read, return empty arrays
    return { rootFolders: [], nestedFolders: [] };
  }
};

/**
 * Creates a regex pattern to ignore specified folders.
 * The pattern will match paths where the specified folders appear as complete path segments.
 * Special regex characters in folder names are automatically escaped.
 * @param {Object|string[]} options - Options object
 * @param {string[]} [options.nestedFolders] - Array of folder names to ignore anywhere in the path
 * @param {string[]} [options.rootFolders] - Array of folder names that should only match at the root level
 * @returns {RegExp} - Regex pattern to ignore the specified folders
 */
function createIgnoreFoldersRegex(options) {
  const nestedFolders = options.nestedFolders || [];
  const rootFolders = options.rootFolders || [];

  if (!Array.isArray(nestedFolders) || nestedFolders.length === 0) {
    throw new Error('nestedFolders must be a non-empty array');
  }

  // If rootFolders is not provided or empty, use the original behavior
  if (!rootFolders || !Array.isArray(rootFolders) || rootFolders.length === 0) {
    // Escape special regex characters in folder names
    const escapedFolders = nestedFolders.map(folder => 
      folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    // Join folder names with | for the regex pattern
    const foldersPattern = escapedFolders.join('|');

    // Create a regex that matches paths where the specified folders appear as complete path segments
    // Format: /(^|\/)(folder1|folder2|folder3)(\/|$)/
    return new RegExp(`(^|\\/)(${foldersPattern})(\\/|$)`);
  }

  // Handle both rootFolders and nestedFolders
  // Escape special regex characters in folder names
  const escapedNestedFolders = nestedFolders.map(folder => 
    folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  const escapedRootFolders = rootFolders.map(folder => 
    folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  // Join folder names with | for the regex patterns
  const nestedFoldersPattern = escapedNestedFolders.join('|');
  const rootFoldersPattern = escapedRootFolders.join('|');

  // Create a regex that matches:
  // 1. Root folders at the beginning of the path: /^(folderRootOnly)(\/|$)/
  // 2. Nested folders anywhere in the path: /(^|\/)(folderAny1|folderAny2)(\/|$)/
  const pattern = `^(${rootFoldersPattern})(\\/|$)|(^|\\/)(${nestedFoldersPattern})(\\/|$)`;
  return new RegExp(pattern);
}

/**
 * Creates a glob config array for ignoring specified folders.
 * For nested folders, the pattern will be "**/" + folder + "/**".
 * For root folders, the pattern will be folder + "/**".
 * @param {Object} options - Options object
 * @param {string[]} [options.nestedFolders] - Array of folder names to ignore anywhere in the path
 * @param {string[]} [options.rootFolders] - Array of folder names that should only match at the root level
 * @returns {string[]} - Array of glob patterns to ignore the specified folders
 */
function createIgnoreGlobConfig(options = {}) {
  const nestedFolders = options.nestedFolders || [];
  const rootFolders = options.rootFolders || [];
  const globPatterns = [];

  // Create glob patterns for nested folders: **/{nestedFolder}/**
  if (Array.isArray(nestedFolders) && nestedFolders.length > 0) {
    nestedFolders.forEach(folder => {
      // Remove leading ./ or / if present
      const cleanFolder = folder.replace(/^(\.\/|\/)/g, '');
      globPatterns.push(`**/${cleanFolder}/**`);
    });
  }

  // Create glob patterns for root folders: {rootFolder}/**
  if (Array.isArray(rootFolders) && rootFolders.length > 0) {
    rootFolders.forEach(folder => {
      // Remove leading ./ or / if present
      const cleanFolder = folder.replace(/^(\.\/|\/)/g, '');
      globPatterns.push(`${cleanFolder}/**`);
    });
  }

  return globPatterns;
}

module.exports = {
  createIgnoreFoldersRegex,
  getMeteorIgnoreEntries,
  createIgnoreGlobConfig,
};
