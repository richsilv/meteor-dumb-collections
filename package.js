Package.describe({
  name: 'richsilv:polledcollection',
  summary: 'Meteor Collections which only sync with the server on request and are saved in local storage.'
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
  api.use('amplify', 'client');
  api.use('mongo', ['client', 'server']);
  api.use('random', ['client', 'server']);
  api.use('underscore', ['client', 'server']);
  api.use('tracker', ['client']);
  api.use('reactive-var', ['client']);

  api.add_files('richsilv:polledcollection.js', ['client', 'server']);

  /*
   * Export global symbols.
   *
   * Example:
   *  api.export('GlobalSymbol');
   */
  api.export('PolledCollection');
});

Package.on_test(function (api) {
  api.use('richsilv:polledcollection');
  api.use('tinytest');
  
  api.add_files('richsilv:polledcollection_tests.js');
});
