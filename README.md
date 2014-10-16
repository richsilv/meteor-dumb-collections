richsilv:dumb-collections
=======================

Dumb Collections for Meteor, in which the client syncs with server only on demand.

## Why?

To avoid the livedata overhead associated with the usual pub/sub model, whilst retaining the benefits of minimongo and the Collections API.  Also utilises localStorage to improve load times.

## Usage

```javascript```
MyCollection = new DumbCollection('mycollection');
```

## Extra Methods *(Client only)*

#### DumbCollection.ready()

Reactive variable: `true` once the initial load from localStorage is complete (whether it has yielded any documents or not), `false` before.

#### DumbCollection.synced()

Reactive variable:`true` once the first server `sync` has been completed.  On further `sync` calls are collected, this will revert to `false` until the new sync is completed.

#### DumbCollection.sync(options)

Synchronise data with the server.  Synchronisation is *always from server to client*.  If you want to write any data from the client to the server, you need to write Meteor.methods and call insert/update/remove on the server.  This would work in exactly the same way as for any normal collection.

#### *Options*

__*query*__ - the Mongo query to apply on the server, which will dictate what data is returned.  If absent, the entire collection will be sent.  Note that documents which fall outside the query will be removed from the client collection unless `retain` is set to true.

__*retain*__ - if set to `true`, the client collection will retain any documents which are not present on the server.  Default is `false`.

__*reject*__ - if set to `true`, the client collection will reject any new documents sent by the server.  Default is `false`.

__*removalCallback(removedDocs)*__ - callback to run once any unrecognised documents are removed from the client collection, with the removed documents passed as an argument.

__*insertionCallback(insertedDocs)*__ - callback to run once any new documents sent by the server have been inserted, with the inserted documents passed as an argument.

__*syncCallback(results)*__ - callback to run once the whole synchronisation is complete, with the results object containing the keys `removed` and `inserted`, which contain the same details as the previous callbacks respectively.

__*failCallback(error)*__ - callback to run on the failure to store the client collection in localStorage once synchronisation is complete.  This is passed the error object, which is almost always the result of the storage limit being exceeded.

#### DumbCollection.clear()

Clear the contents of the client-side collection, and associated local storage.

## Limitations

* Synchronisation is always from the server to the client by design, so the user will need to write Meteor.methods with appropriate security to perform CUD in the opposite direction.
* The `update` method on the server collection has been renamed `_update` in an attempt to discourage its use - the synchronisation is based on `_id`s, and so any `update`s made on the server side cannot be synchronised.  Given that one cannot update the `_id` field in MongoDB, it is necessary to remove and then insert, and rather than writing a method for this, it has been left to the user to tailor to their use case.
* localStorage is a limited size, and if this is exceeded then *no* documents will be stored locally, with synchronisation required to populate the collection on the server.  The `failCallback` will be fired in this case.
