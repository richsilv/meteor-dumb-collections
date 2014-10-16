richsilv:dumb-collections
=======================

Dumb Collections (in which the client syncs with server only on demand) for Meteor.js.

## Why?

To avoid the livedata overhead associated with the usual pub/sub model, whilst retaining the benefits of minimongo and the Collections API.  Also utilises localStorage to improve load times.

## Usage

```javascript```
MyCollection = new DumbCollection('mycollection');
```

## Extra Methods *(Client only)*

#### DumbCollection.ready()

Reactive variable.  True once the initial load from localStorage is complete (whether it has yielded any documents or not), false before.

#### DumbCollection.synced()

Reactive variable.  True once the first server `sync` has been completed.  On further `sync` calls are collected, this will revert to `false` until the new sync is completed.

#### DumbCollection.sync(options)

Synchronise data with the server.  Synchronisation is *always from server to client*.  If you want to write any data from the client to the server, you need to write Meteor.methods and call insert/update/remove on the server.  This would work in exactly the same way as for any normal collection.

##### Options

*
