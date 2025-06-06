Package.describe({
  summary: "Integrate rspack into the Meteor lifecycle to run the bundler independently",
  version: '1.0.0-beta340.0',
});

Package.onUse(function (api) {
  api.use('ecmascript', ['client', 'server']);

  api.mainModule('rspack_server.js', 'server');
  api.mainModule('rspack_client.js', 'client');
});

Package.onTest(function (api) {
  api.use(['tinytest', 'ecmascript', 'rspack']);
  api.addFiles(['rspack_tests.js']);
});
