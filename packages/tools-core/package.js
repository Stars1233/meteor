Package.describe({
  summary: "Helpers for managing modern tools in Meteor",
  version: '1.0.0-beta340.0',
});

Package.onUse(function (api) {
  api.use('ecmascript', ['client', 'server']);

  api.mainModule('tools-core_server.js', 'server');
  api.mainModule('tools-core_client.js', 'client');
});

Package.onTest(function (api) {
  api.use(['tinytest', 'ecmascript', 'tools-core']);
  api.addFiles(['tools-core_tests.js']);
});
