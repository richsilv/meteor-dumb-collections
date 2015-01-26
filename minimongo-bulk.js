// ADAPTED FROM FROZEMAN: https://gist.github.com/frozeman/88a3e47679dd74242cab
/*
These two functions provide a simple extra minimongo functionality to add and remove documents in bulk,
without unnecessary re-renders.

The process is simple. It will add the documents to the collections "_map" and only the last item will be inserted properly
to cause reactive dependencies to re-run.
*/
 
 
Models = {};
 
/*
Inserts documents in bulk.
*/
Models.insertBulk = function(collection, documents){
    if(collection) {
        var last = _.last(documents);
        _.each(documents, function(item){
            if(_.isObject(item)) {
                if (item._id === last._id)
                    collection.insert(item);
                else 
                    collection._collection._docs._map[item._id] = item;
            }
        });
    }
},
 
/*
Removes documents in bulk.
*/
Models.removeBulk = function(collection, ids){
    var _this = this;
 
    if (collection) {
        var lastId = _.last(ids);
        _.each(ids, function(id){
            if (id === lastId)
                collection.remove({_id: id});
            else
                delete collection._collection._docs._map[id];
        });
    }
};

/*
Removes all documents in a collection.
*/
Models.removeAll = function(collection){
    var _this = this;
 
    if (collection) {
        var exampleId = Object.keys(collection._collection._docs._map)[0];
        var newObj = {};
        if (exampleId) newObj[exampleId] = collection._collection._docs._map[exampleId];
        collection._collection._docs._map = newObj;
        if (exampleId) collection.remove({_id: exampleId});
    }
};