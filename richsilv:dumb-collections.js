if (Meteor.isServer) {

	var collections = {};

	DumbCollection = function(name, options) {

		var newCollection = new Mongo.Collection(name, options),
			_this = this;

		newCollection._update = newCollection.update;
		newCollection.update = function() {
			throw new Meteor.Error(500, "Please do not use update on a Dumb Collection on the server - remove and reinsert docs instead.");
		}

		collections[name] = newCollection;

		return newCollection;

	}

	Meteor.methods({

		dumbCollectionGetNew: function(existing, name, query, options) {

			return collections[name].find(_.extend(query || {}, {
				_id: {
					$nin: existing
				}
			}), options || {}).fetch();

		},

		dumbCollectionGetRemoved: function(existing, name, query) {

			var currentIds = {};

			collections[name].find(query || {}, {
				fields: {
					_id: true
				}
			}).forEach(function(doc) {
				currentIds[doc._id] = true;
			});

			this.unblock();

			var missingIds = existing.filter(function(docId){
			    return !(docId in currentIds);
			});

			return missingIds || [];

		}

	});

} else if (Meteor.isClient) {

	DumbCollection = function(name, options) {

		var coll = new Mongo.Collection(null, options);

		var existingDocs = amplify.store('dumbCollection_' + name) || [];

		coll.name = name;
		coll.syncing = false;
		coll._readyFlag = new ReactiveVar(false);
		coll._syncFlag = new ReactiveVar(false);

		Models.insertBulk(coll, existingDocs);
		coll._readyFlag.set(true);
		console.log("Dumb Collection " + name + " seeded with " + existingDocs.length.toString() + " docs from local storage.");


		coll.sync = function(options) {

			options = options || {};

			if (coll.syncing) throw new Meteor.Error('already_syncing', 'Cannot sync whilst already syncing');

			var jobsComplete = {
					remove: options.retain,
					insert: options.reject
				},
				completionDep = new Deps.Dependency(),
				results = {},
				currentIds = [];

			coll._syncFlag.set(false);

			Tracker.autorun(function(outerComp) {

				if (coll.ready() && !coll.syncing) {

					coll.syncing = true;

					currentIds = _.pluck(coll.find({}, {
						reactive: false,
						fields: {
							_id: 1
						}
					}).fetch(), '_id');

					if (!options.retain) {
						Meteor.call('dumbCollectionGetRemoved', currentIds, coll.name, options.query, function(err, res) {
							Models.removeBulk(coll, res);
							results.removed = res;
							jobsComplete.remove = true;
							completionDep.changed();
							options.removalCallback && options.removalCallback.call(coll, removed);
						});
					} else jobsComplete.remove = true;

					if (!options.reject) {
						Meteor.call('dumbCollectionGetNew', currentIds, coll.name, options.query, options.options, function(err, res) {
							results.inserted = res;
							Models.insertBulk(coll, res);
							jobsComplete.insert = true;
							completionDep.changed();
							options.insertionCallback && options.insertionCallback.call(coll, res);
						});
					} else jobsComplete.insert = true;

					Tracker.autorun(function(innerComp) {

						completionDep.depend();

						if (jobsComplete.remove && jobsComplete.insert) {

							innerComp.stop()
							outerComp.stop();
							coll._syncFlag.set(true);
							coll.syncing = false;

							var syncedCollection = coll.find().fetch();
							try {
								amplify.store('dumbCollection_' + coll.name, syncedCollection);
							}
							catch (e) {
								console.log("Collection cannot be stored in Local Storage.");
								options.failCallback && options.failCallback.call(coll, e);
							}
							finally {
								console.log("Dumb Collection " + coll.name + " now has " + syncedCollection.length + " documents stored locally.");
								options.syncCallback && options.syncCallback.call(coll, results);
							}
						}

					});

				}

			});

		};

		coll.clear = function(reactive) {

			Models.removeAll(coll);
			amplify.store('dumbCollection_' + coll.name, []);
			if (reactive) {
				coll._syncFlag.set(false);
			} else {
				coll._syncFlag.curValue = false;
			}
		};

		coll.ready = function() {

			return coll._readyFlag.get();

		};

		coll.synced = function() {

			return coll._syncFlag.get();

		};

		coll.ironRouterReady = function() {

			return {
				ready: function() {
					return coll._syncFlag.get();
				}
			}

		};

		return coll;

	}

}
