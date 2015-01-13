richsilv:dumb-collections
=======================

Dumb Collections for Meteor, in which the client syncs with server only on demand.

## Why?

To avoid the livedata overhead associated with the usual pub/sub model, whilst retaining the benefits of minimongo and the Collections API.  Also utilises localStorage to improve load times.

## NEW IN VERSION 1.1.0

* Now compatible with Collection2 (BUT SEE IMPORTANT NOTE BELOW!!!).
* Ability to specify `options` as well as `query` when syncing.
* Insertion and removal is now far, far more efficient.
* `reactive` parameter to allow client-side collection to be cleared non-reactively.

## Usage

```javascript```
MyCollection = new DumbCollection('mycollection');
```

## Extra Methods *(Client only)*

#### DumbCollection.ready()

Reactive variable: `true` once the initial load from localStorage is complete (whether it has yielded any documents or not), `false` beforehand.

#### DumbCollection.synced()

Reactive variable:`true` once the first server `sync` has been completed.  On further `sync` calls, this will revert to `false` until the new sync is completed.

#### DumbCollection.sync(options)

Synchronise data with the server.  Synchronisation is *always from server to client*.  If you want to write any data from the client to the server, you need to write Meteor.methods and call insert/update*/remove on the server.  This would work in exactly the same way as for any normal collection (although see below for update).

##### *Options*

__*query*__ - the Mongo query to apply on the server, which will dictate what data is returned.  If absent, the entire collection will be sent.  Note that documents which fall outside the query will be removed from the client collection unless `retain` is set to true.

__*options*__ - query options, as per [the Collections API](http://docs.meteor.com/#/full/find).  `reactive` will be ignored, `transform` is untested.

__*retain*__ - if set to `true`, the client collection will retain any documents which are not present in the server result set.  Default is `false`.

__*reject*__ - if set to `true`, the client collection will reject any new documents sent by the server.  Default is `false`.

__*removalCallback(removedDocs)*__ - callback to run once any unrecognised documents are removed from the client collection, with the removed documents passed as an argument.

__*insertionCallback(insertedDocs)*__ - callback to run once any new documents sent by the server have been inserted, with the inserted documents passed as an argument.

__*syncCallback(results)*__ - callback to run once the whole synchronisation is complete, with the results object containing the keys `removed` and `inserted`, which contain the same details as the previous callbacks respectively.

__*failCallback(error)*__ - callback to run on the failure to store the client collection in localStorage once synchronisation is complete.  This is passed the error object, which is almost always the result of the storage limit being exceeded.

#### DumbCollection.clear(reactive)

Clear the contents of the client-side collection, and associated local storage.

##### reactive [BOOLEAN]

This method will set the reactive variable returned by `synced()` to `false`.  However, by passing this flag, the value will be changed in a way which does not invalidate dependent computations.  Note that computations dependent on the documents in the collection itself will still be invalidated.

#### DumbCollection.ironRouterReady()

A convenience method for allowing the use of Iron Router's wait and waitOn methods with Dumb Collections.  Returns a handle with a single, reactive "ready" method, which indicates whether the collection has been synchronised.  This allows one to do the following:

```javascript
waitOn: function() {
  return MyDumbCollection.ironRouterReady();
}
```

**Note 1** - This relates to the 1.0.0 release of Iron Router - it is untested with previous versions.

**Note 2** - If you only want to wait for the collection to be loaded from localStorage rather than being synchronised, just return the collection itself (i.e. `return MyDumbCollection;`).

**Note 3** - If you want to run the synchronisation from Iron Router hooks, you *must* do this from the `onRun` hook, rather than `onBeforeAction`, `data`, or any of the other reactive hooks.  If you don't then the route will continually reload reactively and the Dumb Collection will try to resynchronise each time.  See the demo for an example.

## Using this package with Collection2 (or SimpleSchema)

DumbCollections uses the `mizzao:user-status` package, which adds a `status` property to user objects.  This means that if you are applying a schema to you user objects with Collections2 (or SimpleSchema), you need to allow for this property in the schema definition as follows:

```javascript
Schemas.User = new SimpleSchema({
  status: {
    type: Object,
    optional: true,
    blackbox: true
  },
  ... // other stuff
});
```

## Limitations

* Synchronisation is always from the server to the client by design, so the user will need to write Meteor.methods with appropriate security to perform CUD in the opposite direction.
* The `update` method on the server collection has been renamed `_update` in an attempt to discourage its use - the synchronisation is based on `_id`s, and so any `update`s made on the server side cannot be synchronised.  Given that one cannot update the `_id` field in MongoDB, it is necessary to remove and then insert, and rather than writing a method for this, it has been left to the user to tailor to their use case.
* localStorage is a limited size, and if this is exceeded then *no* documents will be stored locally, with synchronisation required to populate the collection on the server.  The `failCallback` will be fired in this case.

## Demo

There is a demo deployed at [dumb-collections-demo.meteor.com](http://dumb-collections-demo.meteor.com), with the code available at [github.com/richsilv/dumb-collections-demo](https://github.com/richsilv/dumb-collections-demo).
