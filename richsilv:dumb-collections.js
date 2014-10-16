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

		dumbCollectionGetNew: function(existing, name, query) {

			return collections[name].find(_.extend(query || {}, {
				_id: {
					$nin: existing
				}
			})).fetch();

		},

		dumbCollectionGetRemoved: function(existing, name, query) {

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

	DumbCollection = function(name, maxOps, interval) {

		var _this = this,
			existingDocs = amplify.store('dumbCollection_' + name) || [],
			localStorageQueue = queue();

		this.name = name;
		this._collection = new Mongo.Collection(null);
		this._readyFlag = new ReactiveVar(false);
		this._syncFlag = new ReactiveVar(false);

		for (prop in this._collection) {
			if (typeof _this._collection[prop] === 'function')
				_this[prop] = _this._collection[prop].bind(_this._collection);
			else
				_this[prop] = _this._collection[prop];
		}

		for (var i = existingDocs.length - 1; i >= 0; i--) {
			localStorageQueue.defer(function(cb) {
				var doc = existingDocs[i];
				Meteor.defer(function() {
					_this.insert.call(_this, doc);
					cb();
				});
			});
		}
		localStorageQueue.await(function() {
			Meteor.defer(function() {
				_this._readyFlag.set(true);
				console.log("Dumb Collection " + name + " seeded with " + existingDocs.length.toString() + " docs from local storage.");
			});
		});

	}

	DumbCollection.prototype.sync = function(options) {

		options = options || {};

		var _this = this,
			jobsComplete = {
				remove: options.retain,
				insert: options.reject
			},
			completionDep = new Deps.Dependency(),
			results = {},
			currentIds = [],
			removeQueue = queue(),
			insertQueue = queue();

		_this._syncFlag.set(false);

		Tracker.autorun(function(outerComp) {

			if (_this.ready()) {

				currentIds = _.pluck(_this.find({}, {
					reactive: false,
					fields: {
						_id: 1
					}
				}).fetch(), '_id');

				if (!options.retain) {
					Meteor.call('dumbCollectionGetRemoved', currentIds, _this.name, options.query, function(err, res) {
						var removed = _this.find({
							_id: {
								$in: res
							}
						}, {
							reactive: false
						}).fetch();
						res.forEach(function(id) {
							removeQueue.defer(function(cb) {
								Meteor.defer(function(c) {
									_this.remove({
										_id: id
									});
									cb();
								});
							});
						});
						removeQueue.await(function() {
							Meteor.defer(function() {
								results.removed = removed;
								jobsComplete.remove = true;
								completionDep.changed();
								options.removalCallback && options.removalCallback.call(_this, removed);
							});
						});
					});
				}

				if (!options.reject) {
					Meteor.call('dumbCollectionGetNew', currentIds, _this.name, options.query, function(err, res) {
						results.inserted = res;
						res.forEach(function(doc) {
							insertQueue.defer(function(cb) {
								Meteor.defer(function() {
									_this.insert(doc);
									cb();
								});
							});
						});
						insertQueue.await(function() {
							Meteor.defer(function() {
								jobsComplete.insert = true;
								completionDep.changed();
								options.insertionCallback && options.insertionCallback.call(_this, res);
							});
						});
					});
				}

				Tracker.autorun(function(innerComp) {

					completionDep.depend();

					if (jobsComplete.remove && jobsComplete.insert) {

						innerComp.stop()
						outerComp.stop();
						_this._syncFlag.set(true);

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

	}

	DumbCollection.prototype.clear = function() {

		this.remove();
		amplify.store('dumbCollection_' + this.name, []);

	}

	DumbCollection.prototype.ready = function() {

		return this._readyFlag.get();

	}

	DumbCollection.prototype.synced = function() {

		return this._syncFlag.get();

	}

}