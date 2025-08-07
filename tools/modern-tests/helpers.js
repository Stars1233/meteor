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
 * @param {Object} options - Additional options
 * @param {string|RegExp} options.waitForOutput - Output pattern to wait for
 * @param {Object} options.waitOptions - Options for waitForMeteorOutput
 * @param {string[]} options.commandOptions - Additional command line options for the run command (e.g. ['--production'])
 * @returns {Object} - The meteor process and output lines
 */
export async function runMeteorApp(tempDir, port, options = {}) {
  // Start Meteor CLI in dev mode
  console.log(`Starting Meteor app on port ${port}...`);

  // Determine if we need to capture output
  const captureOutput = !!options.waitForOutput;

  // Combine port option with any additional command options
  const args = ['--port', port.toString()];
  if (options.commandOptions && Array.isArray(options.commandOptions)) {
    args.push(...options.commandOptions);
  }

  // Run the meteor command
  const { meteorProcess, outputLines } = await runMeteorCommand(
    'run', 
    args, 
    tempDir,
    {},
    captureOutput
  );

  // If a specific output pattern is requested, wait for it
  if (options.waitForOutput) {
    await waitForMeteorOutput(
      outputLines,
      options.waitForOutput,
      options
    );
  }

  // Wait for server to be up
  console.log(`Waiting for app to be available on port ${port}...`);
  await waitOn({
    resources: [`http-get://localhost:${port}`],
    timeout: 60000
  });

  return { meteorProcess, outputLines };
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
 * Helper function to run any Meteor command
 * @param {string} command - The Meteor command to run (e.g., 'run', 'build', 'test')
 * @param {string[]} args - Additional arguments for the command
 * @param {string} cwd - Working directory where the command should be executed
 * @param {Object} options - Additional options for execa
 * @param {boolean} captureOutput - Whether to capture the command's output
 * @returns {Object} - The meteor process and output lines if capturing output
 */
export async function runMeteorCommand(command, args = [], cwd, options = {}, captureOutput = false) {
  console.log(`Running Meteor command: ${command} ${args.join(' ')}...`);

  const execaOptions = {
    cwd,
    ...options
  };

  // If we're capturing output, set up stdio accordingly
  if (captureOutput) {
    execaOptions.stdio = ['inherit', 'pipe', 'pipe'];
  } else {
    execaOptions.stdio = 'inherit';
  }

  const meteorProcess = execa(METEOR_EXECUTABLE, [command, ...args], execaOptions);

  // If we're capturing output, set up the output collection
  let outputLines = [];
  if (captureOutput && meteorProcess.stdout && meteorProcess.stderr) {
    meteorProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      outputLines.push(...lines);
      // Still log to console for visibility
      process.stdout.write(data);
    });

    meteorProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      outputLines.push(...lines);
      // Still log to console for visibility
      process.stderr.write(data);
    });
  }

  return { meteorProcess, outputLines };
}

/**
 * Helper function to create a new Meteor app with a specific example
 * @param {string} appName - Name of the new app
 * @param {string} example - Example to use (e.g., 'react', 'vue')
 * @param {Object} options - Additional options for execa
 * @returns {Object} - The path to the new app and the meteor process
 */
export async function createMeteorApp(appName, example, options = {}) {
  // Create a unique temporary directory that will be the app directory directly
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const tempAppName= `${appName}-${randomSuffix}`;
  const tempDir = path.join(os.tmpdir(), tempAppName);

  console.log(`Creating new Meteor app '${appName}' with example '${example}' in ${tempDir}...`);

  // Create the destination directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    await fs.mkdir(tempDir, { recursive: true });
  }

  // Run 'meteor create --react myapp' command
  const args = ['create'];

  // Add example option if provided
  if (example) {
    args.push(`--${example}`);
  }

  // Add app name
  args.push(tempAppName);

  // Run the command in the temporary directory
  const { meteorProcess } = await runMeteorCommand(args[0], args.slice(1), os.tmpdir(), options);

  return { tempDir, meteorProcess };
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
      // Implement async removal as a fallback
      return new Promise((resolve, reject) => {
        rimraf(tempDir, { disableGlob: true, maxRetries: 5, retryDelay: 500 }, (error) => {
          if (error) {
            console.error(`Async removal also failed: ${error}`);
            reject(error);
          } else {
            console.log(`Removed temporary directory: ${tempDir}`);
            resolve();
          }
        });
      });
    }
  }
}

/**
 * Helper function to wait for a specific number of milliseconds
 * @param {number} ms - The number of milliseconds to wait
 * @returns {Promise<void>} - A promise that resolves after the specified time
 */
export async function wait(ms) {
  console.log(`Waiting for ${ms} milliseconds...`);
  return new Promise(resolve => {
    setTimeout(() => {
      console.log(`Finished waiting for ${ms} milliseconds`);
      resolve();
    }, ms);
  });
}

/**
 * Helper function to wait for specific output from a Meteor process
 * @param {string[]} outputLines - Array that will be populated with output lines
 * @param {string|RegExp} pattern - String or RegExp pattern to wait for
 * @param {Object} options - Options for waiting
 * @param {number} options.timeout - Maximum time to wait in milliseconds
 * @param {number} options.checkInterval - Interval between checks in milliseconds
 * @returns {Promise<string>} - A promise that resolves with the matched line
 */
export async function waitForMeteorOutput(outputLines, pattern, options = {}) {
  const timeout = options.timeout || 60000; // Default 1 minute timeout
  const checkInterval = options.checkInterval || 100; // Check every 100ms by default

  console.log(`Waiting for output matching: ${pattern}`);

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    // Function to check for the pattern in the output lines
    const checkForPattern = () => {
      // Check if we've exceeded the timeout
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for output matching: ${pattern}`));
        return;
      }

      // Check each line for the pattern
      for (const line of outputLines) {
        if (typeof pattern === 'string' && line.includes(pattern)) {
          console.log(`Found output matching string: ${pattern}`);
          resolve(line);
          return;
        } else if (pattern instanceof RegExp && pattern.test(line)) {
          console.log(`Found output matching regex: ${pattern}`);
          resolve(line);
          return;
        }
      }

      // If we didn't find a match, check again after the interval
      setTimeout(checkForPattern, checkInterval);
    };

    // Start checking
    checkForPattern();
  });
}
