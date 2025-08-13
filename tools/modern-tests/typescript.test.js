import {
  waitForMeteorOutput,
} from "./helpers";
import { testMeteorBundler, testMeteorRspackBundler } from './test-helpers';

describe('TypeScript App Bundling /', () => {
  describe('Meteor Bundler /', testMeteorBundler({
    appName: 'typescript',
    port: 3111
  }));

  describe('Meteor+Rspack Bundler /', testMeteorRspackBundler({
    appName: 'typescript',
    port: 3112,
    filePaths: { 
      client: 'client/main.tsx', 
      server: 'server/main.ts',
      test: 'tests/main.ts'
    },
    customAssertions: {
      afterRun: async ({ result }) => {
        await waitForTypeScriptEnvs(result.outputLines, { isTsxEnabled: true });
        await waitForTypeScriptErrorFree(result.outputLines);
      },
      afterRunProduction: async ({ result }) => {
        await waitForTypeScriptEnvs(result.outputLines, { isTsxEnabled: true });
      },
      afterTest: async ({ result }) => {
        await waitForTypeScriptEnvs(result.outputLines);
      },
      afterTestOnce: async ({ result }) => {
        await waitForTypeScriptEnvs(result.outputLines);
      },
      afterBuild: async ({ result }) => {
        await waitForTypeScriptEnvs(result.outputLines, { isTsxEnabled: true });
      },
    }
  }));
});

/**
 * Helper function to wait for TypeScript environment output from both Rspack Client and Server
 * @param {string[]} outputLines - Array that will be populated with output lines
 * @param {Object} options - Options for waiting
 * @param {number} options.timeout - Maximum time to wait in milliseconds
 * @param {number} options.checkInterval - Interval between checks in milliseconds
 * @returns {Promise<void>} - A promise that resolves when both client and server are error-free
 */
export async function waitForTypeScriptEnvs(outputLines, options = {}) {
  await waitForMeteorOutput(
    outputLines,
    /.*isTypescriptEnabled:.*true.*/,
    options
  );
  if (options.isTsxEnabled) {
    await waitForMeteorOutput(
      outputLines,
      /.*isTsxEnabled:.*true.*/,
      options
    );
  }
}

/**
 * Helper function to wait for TypeScript error-free output from both Rspack Client and Server
 * @param {string[]} outputLines - Array that will be populated with output lines
 * @param {Object} options - Options for waiting
 * @param {number} options.timeout - Maximum time to wait in milliseconds
 * @param {number} options.checkInterval - Interval between checks in milliseconds
 * @returns {Promise<void>} - A promise that resolves when both client and server are error-free
 */
export async function waitForTypeScriptErrorFree(outputLines, options = {}) {
  await waitForMeteorOutput(
    outputLines,
    /.*\[Rspack.*Client].*No TypeScript errors found\./,
    options
  );
  await waitForMeteorOutput(
    outputLines,
    /.*\[Rspack.*Server].*No TypeScript errors found\./,
    options
  );
  console.log(`Custom Plugin usage: ts-checker-rspack-plugin`);
}
