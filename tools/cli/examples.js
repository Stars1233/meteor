var files = require('../fs/files');
var httpHelpers = require('../utils/http-helpers.js');
var Console = require('../console/console.js').Console;
const { exec } = require('child_process');

const EXAMPLES_REPO = 'https://github.com/meteor/examples';
const EXAMPLES_BRANCH = 'meteor-3.x';
const EXAMPLES_JSON_URL =
  `https://raw.githubusercontent.com/meteor/examples/${EXAMPLES_BRANCH}/examples.json`;

function validateExamplesData(data) {
  if (!Array.isArray(data)) {
    throw new Error('Invalid examples.json format: expected a JSON array.');
  }
  return data.filter(entry => {
    if (!entry.slug || typeof entry.slug !== 'string') {
      Console.warn(`Skipping example entry with missing slug`);
      return false;
    }
    if (!entry.repositoryUrl || typeof entry.repositoryUrl !== 'string') {
      Console.warn(`Skipping example '${entry.slug}' with missing repositoryUrl`);
      return false;
    }
    return true;
  });
}

function getCachePath() {
  return files.pathJoin(files.getHomeDir(), '.meteor', 'examples-cache.json');
}

function readCache() {
  const cachePath = getCachePath();
  if (!files.exists(cachePath)) return null;
  try {
    const raw = files.readFile(cachePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeCache(data) {
  const cachePath = getCachePath();
  files.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf8');
}

async function fetchExamplesJson() {
  const response = await httpHelpers.request({
    url: EXAMPLES_JSON_URL,
    method: 'GET',
  });
  if (response.statusCode !== 200) {
    throw new Error(
      `Failed to fetch examples.json (HTTP ${response.statusCode})`
    );
  }
  let data;
  try {
    data = JSON.parse(response.body);
  } catch (e) {
    throw new Error('Invalid JSON received from examples repository.');
  }
  return validateExamplesData(data);
}

async function getExamples({ refresh = false } = {}) {
  if (!refresh) {
    const cached = readCache();
    if (cached && cached.examples) {
      return cached.examples;
    }
  }

  const examples = await fetchExamplesJson();

  if (examples.length === 0) {
    throw new Error('No valid examples found in examples.json.');
  }

  writeCache({
    fetchedAt: new Date().toISOString(),
    branch: EXAMPLES_BRANCH,
    examples,
  });

  return examples;
}

function findExample(examples, slug) {
  return examples.find(e => e.slug === slug) || null;
}

async function cloneRepo(url, destPath) {
  return new Promise((resolve, reject) => {
    exec('git --version', (error) => {
      if (error) {
        reject(new Error('git is not installed'));
        return;
      }

      process.env.GIT_TERMINAL_PROMPT = 0;

      const isWindows = process.platform === 'win32';
      const dest = isWindows
        ? `"${files.convertToOSPath(destPath)}"`
        : destPath;
      const command = `git clone --progress ${url} ${dest}`;

      exec(command, { env: process.env }, async (cloneError) => {
        if (cloneError) {
          // git clone writes progress to stderr, so only reject on real errors
          // "Cloning into" on stderr is normal git output, not an error
          const msg = cloneError.message || '';
          if (!msg.includes('Cloning into')) {
            reject(new Error(`Failed to clone ${url}: ${msg}`));
            return;
          }
        }

        try {
          // Remove .git folder from the cloned repo
          await files.rm_recursive_async(files.pathJoin(destPath, '.git'));
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  });
}

async function cloneSubdirectory(repoUrl, branch, subdir, destPath) {
  const tempDir = files.mkdtemp('meteor-example-');
  try {
    const branchArg = branch ? `--branch ${branch} ` : '';
    const command = `git clone --progress ${branchArg}${repoUrl} ${tempDir}`;

    process.env.GIT_TERMINAL_PROMPT = 0;

    await new Promise((resolve, reject) => {
      exec(command, { env: process.env }, (error) => {
        if (error) {
          const msg = error.message || '';
          if (!msg.includes('Cloning into')) {
            reject(new Error(`Failed to clone ${repoUrl}: ${msg}`));
            return;
          }
        }
        resolve();
      });
    });

    const subdirPath = files.pathJoin(tempDir, subdir);
    if (!files.exists(subdirPath)) {
      throw new Error(
        `Directory '${subdir}' not found in the repository. The examples list may be outdated — try 'meteor create --list --refresh'.`
      );
    }

    await files.cp_r(subdirPath, destPath);

    // Remove .git if it was copied
    const destGit = files.pathJoin(destPath, '.git');
    if (files.exists(destGit)) {
      await files.rm_recursive_async(destGit);
    }
  } finally {
    // Clean up temp directory
    await files.rm_recursive_async(tempDir);
  }
}

function validateMeteorApp(dirPath) {
  const meteorDir = files.pathJoin(dirPath, '.meteor');
  if (!files.exists(meteorDir)) {
    throw new Error(
      `The directory '${files.convertToOSPath(dirPath)}' is not a Meteor app (no .meteor directory found).`
    );
  }
}

module.exports = {
  validateExamplesData,
  getExamples,
  findExample,
  cloneRepo,
  cloneSubdirectory,
  validateMeteorApp,
  EXAMPLES_REPO,
  EXAMPLES_BRANCH,
  EXAMPLES_JSON_URL
};
