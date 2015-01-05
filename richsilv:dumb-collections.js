if (Meteor.isServer) {

	var collections = {};

	DumbCollection = function(name) {

		var newCollection = new Mongo.Collection(name),
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

	DumbCollection = function(name) {

		var _this = this,
			existingDocs = amplify.store('dumbCollection_' + name) || [];

		this.name = name;
		this.syncing = false;
		this._readyFlag = new ReactiveVar(false);
		this._syncFlag = new ReactiveVar(false);

		Models.insertBulk(this, existingDocs);
		_this._readyFlag.set(true);
		console.log("Dumb Collection " + name + " seeded with " + existingDocs.length.toString() + " docs from local storage.");

	};

	DumbCollection.prototype = new Mongo.Collection(null);

	DumbCollection.prototype.sync = function(options) {

		options = options || {};

		if (this.syncing) throw new Meteor.Error('already_syncing', 'Cannot sync whilst already syncing');

		var _this = this,
			jobsComplete = {
				remove: options.retain,
				insert: options.reject
			},
			completionDep = new Deps.Dependency(),
			results = {},
			currentIds = [];

		_this._syncFlag.set(false);

		Tracker.autorun(function(outerComp) {

			if (_this.ready() && !_this.syncing) {

				_this.sycing = true;

					currentIds = _.pluck(_this.find({}, {
					reactive: false,
					fields: {
						_id: 1
					}
				}).fetch(), '_id');

				if (!options.retain) {
					Meteor.call('dumbCollectionGetRemoved', currentIds, _this.name, options.query, function(err, res) {	
						Models.removeBulk(_this, res);
						results.removed = res;
						jobsComplete.remove = true;
						completionDep.changed();
						options.removalCallback && options.removalCallback.call(_this, removed);
					});
				}

				if (!options.reject) {
					Meteor.call('dumbCollectionGetNew', currentIds, _this.name, options.query, options.options, function(err, res) {
						results.inserted = res;
						Models.insertBulk(_this, res);
						jobsComplete.insert = true;
						completionDep.changed();
						options.insertionCallback && options.insertionCallback.call(_this, res);
					});
				}

				Tracker.autorun(function(innerComp) {

					completionDep.depend();

					if (jobsComplete.remove && jobsComplete.insert) {

						innerComp.stop()
						outerComp.stop();
						_this._syncFlag.set(true);
						_this.syncing = false;

						var syncedCollection = _this.find().fetch();
						try {
							amplify.store('dumbCollection_' + _this.name, syncedCollection);
						}
						catch (e) {
							console.log("Collection cannot be stored in Local Storage.");
							options.failCallback && options.failCallback.call(_this, e);
						}
						finally {
							console.log("Dumb Collection " + _this.name + " now has " + syncedCollection.length + " documents stored locally.");
							options.syncCallback && options.syncCallback.call(_this, results);
						}
					}

				});

			}

		});

	};

	DumbCollection.prototype.clear = function(reactive) {

		this.remove({});
		amplify.store('dumbCollection_' + this.name, []);
		if (reactive) {
			this._syncFlag.set(false);
		} else {
			this._syncFlag.curValue = false;
		}
	};

	DumbCollection.prototype.ready = function() {

		return this._readyFlag.get();

	};

	DumbCollection.prototype.synced = function() {

		return this._syncFlag.get();

	};

	DumbCollection.prototype.ironRouterReady = function() {

		var _this = this;

		return {
			ready: function() {
				return _this._syncFlag.get();
			}
		}

	};

}