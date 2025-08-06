const execa = require('execa');
const waitOn = require('wait-on');
const cheerio = require('cheerio');
const path = require('path');

const APP_DIR = path.join(__dirname, 'apps', 'react');
console.log("--> (rspack-run.test.js-Line: 7)\n APP_DIR: ", APP_DIR);
// Get the absolute path to the meteor executable
const REPO_ROOT = path.resolve(__dirname, '../..');
console.log('REPO_ROOT:', REPO_ROOT);
const METEOR_EXECUTABLE = path.join(REPO_ROOT, 'meteor');
console.log('METEOR_EXECUTABLE:', METEOR_EXECUTABLE);

describe('rspack build and serve', () => {
  let meteorProcess;

  beforeAll(async () => {
    // Start Meteor CLI in dev mode
    // Use shell option to run the meteor command through the shell
    meteorProcess = execa(METEOR_EXECUTABLE, ['run', '--port', '3000'], {
      cwd: APP_DIR,
      stdio: 'inherit',
      // stdout: 'inherit',
      // stderr: 'inherit',
      shell: true,
    });

    // Wait for server to be up
    await waitOn({ resources: ['http-get://localhost:3000'], timeout: 30000, log: true, verbose: true });
  });

  afterAll(() => {
    meteorProcess.kill();
  });

  test('responds with valid HTML', async () => {
    // const response = await execa('curl', ['-s', 'http://localhost:3000'], { shell: true });
    // const $ = cheerio.load(response.stdout);
    // expect($('title').text()).toMatch(/Meteor/);
  });
});
