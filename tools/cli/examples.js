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

module.exports = {
  validateExamplesData,
  getExamples,
  EXAMPLES_REPO,
  EXAMPLES_BRANCH,
  EXAMPLES_JSON_URL
};
