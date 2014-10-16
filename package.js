Package.describe({
  name: 'richsilv:dumb-collections',
  version: '1.0.1',
  summary: 'Meteor Collections which only sync with the server on request and are saved in local storage.',
  git: 'git@github.com:richsilv/meteor-dumb-collections.git'
});

Package.on_use(function (api) {
  /* Use or imply other packages.

   * Example:
   *  api.use('ui', 'client');
   *  api.use('iron-router', ['client', 'server']);
   */

   /*
    * Add files that should be used with this
    * package.
    */
  api.use('amplify@1.0.0', 'client');
  api.use('mongo@1.0.7', ['client', 'server']);
  api.use('underscore@1.0.1', ['client', 'server']);
  api.use('tracker@1.0.3', ['client']);
  api.use('reactive-var@1.0.3', ['client']);

  api.add_files('queue/queue.js', ['client', 'server']);
  api.add_files('richsilv:dumb-collections.js', ['client', 'server']);

  /*
   * Export global symbols.
   *
   * Example:
   *  api.export('GlobalSymbol');
   */
  api.export('DumbCollection');
});

Package.on_test(function (api) {
  api.use('richsilv:dumb-collections');
  api.use('tinytest');
  
  api.add_files('richsilv:dumb-collections_tests.js');
});
