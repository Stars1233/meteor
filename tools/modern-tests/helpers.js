const execa = require('execa');
const waitOn = require('wait-on');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const rimraf = require('rimraf');

// Get the absolute path to the meteor executable
const REPO_ROOT = path.resolve(__dirname, '../..');
const METEOR_EXECUTABLE = path.join(REPO_ROOT, 'meteor');

/**
 * Helper function to set up a Meteor app in a temporary directory
 * Copies the app and runs npm install
 * @param {string} appName - Name of the app in the apps directory
 * @returns {string} - Path to the temporary directory containing the app
 */
export async function setupMeteorApp(appName) {
  // Create a unique temporary directory
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const tempDir = path.join(os.tmpdir(), `${appName}-${randomSuffix}`);

  // Source app directory
  const sourceAppDir = path.join(__dirname, 'apps', appName);
  console.log(`Source app directory: ${sourceAppDir}`);
  console.log(`Temporary directory: ${tempDir}`);

  try {
    // Create the destination directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      await fs.mkdir(tempDir, { recursive: true });
    }

    // Use fs-extra's copy method with recursive option
    await fs.copy(sourceAppDir, tempDir, {
      dereference: true,
      preserveTimestamps: true,
      overwrite: true
    });
    console.log(`Copied app to temporary directory: ${tempDir}`);
  } catch (err) {
    console.error('Error during copy:', err);
  }

  // Run npm install in the temporary directory
  console.log('Running npm install...');
  await execa.command('npm install', {
    cwd: tempDir,
    stdio: 'inherit',
    shell: true,
  });

  return { tempDir };
}

/**
 * Helper function to run a Meteor app
 * @param {string} tempDir - Path to the directory containing the app
 * @param {number} port - Port to run the app on
 * @returns {Object} - The meteor process
 */
export async function runMeteorApp(tempDir, port) {
  // Start Meteor CLI in dev mode
  console.log(`Starting Meteor app on port ${port}...`);
  const meteorProcess = execa(METEOR_EXECUTABLE, ['run', '--port', port.toString()], {
    cwd: tempDir,
    stdio: 'inherit',
  });

  // Wait for server to be up
  console.log(`Waiting for app to be available on port ${port}...`);
  await waitOn({
    resources: [`http-get://localhost:${port}`],
    timeout: 60000
  });

  return { meteorProcess };
}

/**
 * Helper function to kill a Meteor process
 * @param {Object} meteorProcess - The Meteor process to kill
 * @returns {Promise<void>}
 */
export async function killMeteorProcess(meteorProcess) {
  if (meteorProcess) {
    try {
      await meteorProcess.kill('SIGKILL');
      console.log('Successfully killed meteor process');
    } catch (err) {
      console.log(`Error killing meteor process: ${err.message}`);
    }
  }
}

/**
 * Kills any process running on the specified port
 * @param {number} port - The port to kill processes on
 * @returns {Promise<void>}
 */
export async function killProcessByPort(port) {
  try {
    // Different commands based on OS
    const command = process.platform === 'win32'
      ? `FOR /F "tokens=5" %a in ('netstat -ano ^| find "LISTENING" ^| find ":${port}"') do taskkill /F /PID %a`
      : `lsof -i :${port} -t | xargs -r kill -9`;

    console.log(`Killing process on port ${port}...`);
    try {
      // Use { reject: false } to prevent execa from throwing on non-zero exit codes
      const result = await execa.command(command, { shell: true, reject: false });
      if (result.failed) {
        // It's okay if this fails because there might not be a process on that port
        console.log(`No process found on port ${port} or command returned non-zero exit code`);
      } else {
        console.log(`Successfully killed process on port ${port}`);
      }
    } catch (err) {
      // This catch block will only be reached for operational errors, not for command failures
      console.log(`Error executing kill command: ${err.message}`);
    }
    console.log(`Successfully ensured no process is running on port ${port}`);
  } catch (error) {
    // This should never be reached with the inner try/catch, but keeping as a safety net
    console.error(`Error killing process on port ${port}:`, error);
  }
}

/**
 * Helper function to clean up a temporary directory
 * @param {string} tempDir - Path to the temporary directory to clean up
 * @returns {Promise<void>}
 */
export async function cleanupTempDir(tempDir) {
  if (tempDir) {
    try {
      rimraf.sync(tempDir, { disableGlob: true, maxRetries: 5, retryDelay: 500 });
      console.log(`Removed temporary directory: ${tempDir}`);
    } catch (err) {
      console.log(`Sync removal failed, trying async removal: ${err}`);
    }
  }
}
