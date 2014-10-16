if (Meteor.isServer) {

	var collections = {};

	PolledCollection = function(name) {

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

		polledCollectionGetNew: function(existing, name, query) {

			return collections[name].find(_.extend(query || {}, {
				_id: {
					$nin: existing
				}
			})).fetch();

		},

		polledCollectionGetRemoved: function(existing, name, query) {

			var currentIds = _.pluck(collections[name].find(query || {}, {
				fields: {
					_id: true
				}
			}).fetch(), '_id');

			this.unblock();
			return _.reduce(existing, function(list, nextId) {
				if (_.indexOf(currentIds, nextId) === -1) list.push(nextId);
				return list;
			}, []);

		}

	});

} else if (Meteor.isClient) {

	PolledCollection = function(name, maxOps, interval) {

		var _this = this,
			existingDocs = amplify.store('polledCollection_' + name) || [];

		this.name = name;
		this._collection = new Mongo.Collection(null);
		this._readyFlag = new ReactiveVar(false);
		this._syncFlag = new ReactiveVar(false);
		this.q = queue();

		for (prop in this._collection) {
			if (typeof _this._collection[prop] === 'function')
				_this[prop] = _this._collection[prop].bind(_this._collection);
			else
				_this[prop] = _this._collection[prop];
		}

		for (var i = existingDocs.length - 1; i >= 0; i--) {
			_this.q.defer(function(cb) {
				var doc = existingDocs[i];
				Meteor.defer(function() {
					_this.insert.call(_this, doc);
					cb();
				});
			});
		}
		_this.q.await(function() {
			Meteor.defer(function() {
				_this._readyFlag.set(true);
				console.log("Polled Collection " + name + " seeded with " + existingDocs.length.toString() + " docs from local storage.");
			});
		});

	}

	PolledCollection.prototype.sync = function(options) {

		options = options || {};

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

			if (_this.ready()) {

				currentIds = _.pluck(_this.find({}, {
					reactive: false,
					fields: {
						_id: 1
					}
				}).fetch(), '_id');

				console.log("Checking " + _this.name + " with " + currentIds.length + " docs");

				if (!options.retain) {
					Meteor.call('polledCollectionGetRemoved', currentIds, _this.name, options.query, function(err, res) {
						var removed = _this.find({
							_id: {
								$in: res
							}
						}, {
							reactive: false
						}).fetch();
						res.forEach(function(id) {
							Meteor.defer(_this.remove.bind(_this, {
								_id: id
							}));
						});
						Meteor.defer(function() {
							results.removed = removed;
							jobsComplete.remove = true;
							completionDep.changed();
							options.removalCallback && options.removalCallback.call(_this, removed);
						});
					});
				}

				if (!options.reject) {
					Meteor.call('polledCollectionGetNew', currentIds, _this.name, options.query, function(err, res) {
						results.inserted = res;
						res.forEach(function(doc) {
							Meteor.defer(_this.insert.bind(_this, doc));
						});
						Meteor.defer(function() {
							jobsComplete.insert = true;
							completionDep.changed();
							options.insertionCallback && options.insertionCallback.call(_this, res);
						});
					});
				}

				Tracker.autorun(function(innerComp) {

					completionDep.depend();

					if (jobsComplete.remove && jobsComplete.insert) {

						outerComp.stop();
						_this._syncFlag.set(true);

						var syncedCollection = _this.find().fetch();
						amplify.store('polledCollection_' + _this.name, syncedCollection);
						console.log("Polled Collection " + _this.name + " now has " + syncedCollection.length + " documents stored locally.");
						options.syncCallback && options.syncCallback.call(_this, results);
					}

				});

			}

		});

	}

	PolledCollection.prototype.clear = function() {

		this.remove();
		amplify.store('polledCollection_' + this.name, []);

	}

	PolledCollection.prototype.ready = function() {

		return this._readyFlag.get();

	}

	PolledCollection.prototype.synced = function() {

		return this._syncFlag.get();

	}

}