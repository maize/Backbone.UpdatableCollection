define([
    "jquery",
    "backbone"], function($, Backbone) {
    var UpdatableCollection = Backbone.Collection.extend({
        fetch: function(options) {
            var self = this;

            var data = typeof options.data !== 'undefined' ? options.data : {};
            var success = typeof options.success !== 'undefined' ? options.success : function() {};
            var error = typeof options.error !== 'undefined' ? options.error : function() {};

            var offset = typeof options.offset !== 'undefined' ? options.offset : 0;
            var limit = typeof options.limit !== 'undefined' ? options.limit : 20;
            var maxLimit = typeof options.maxLimit !== 'undefined' ? options.maxLimit : 50;

            var updateSubset = typeof options.updateSubset !== 'undefined' ? options.updateSubset : false;
            var updateAll = typeof options.updateAll !== 'undefined' ? options.updateAll : false;
            var forceUpdate = typeof options.forceUpdate !== 'undefined' ? options.forceUpdate : false;
            
            var numItems = typeof options.numItems !== 'undefined' ? options.numItems : maxLimit;
            
            var from = offset;
            var to = from+limit;

            var additionalData = {}

            // Last subset fallback
            if (to > numItems) {
                to = numItems;
            }

            if (updateAll) {
                from = 0;
                to = numItems;
            }

            var subsetCollection = null;

            if (updateSubset) {
                console.log("Update subset..");
                console.log("From: "+from);
                console.log("To: "+(from+limit));

                $.ajax({
                    type: 'GET',
                    url:  self.url(),
                    data: $.extend({}, data, {
                        offset: from,
                        limit: limit
                    }),
                    success: function (data) {
                        var newSubset = null;
                        if (data instanceof Object) {
                            newSubset = self.parse(data);
                        } else {
                            newSubset = self.parse(JSON.parse(data));
                        }

                        _(newSubset).each(function(obj, index){
                            obj.orderId = from+index;
                        });

                        self.freshen(from, to, newSubset);

                        subsetCollection = self.getSubset(from, (from+newSubset.length));
                        subsetCollection = new self.constructor(subsetCollection.models, {
                            model: self.model
                        });

                        success.call(this, subsetCollection, self);
                        return subsetCollection;
                    },
                    error: function(e) {
                        error.call(this, e, self);
                    }
                });
                return;
            } else if (updateAll) {
                console.log("Update all..");
                console.log("From: "+from);
                console.log("To: "+to);

                var newCollection = [];
                var stop = Math.ceil(numItems/maxLimit);

                for (var i=0; i<stop; i++) {
                    (function(i) {
                      $.ajax(
                        {
                            type: 'GET',
                            url:  self.url(),
                            data: $.extend({}, data, {
                                offset: i*maxLimit,
                                limit: maxLimit
                            }),
                            dataType: 'json',
                            success: function(data) { 
                                var newSubset = null;
                                if (data instanceof Object) {
                                    newSubset = self.parse(data);
                                } else {
                                    newSubset = self.parse(JSON.parse(data));
                                }

                                _(newSubset).each(function(obj, index){
                                    obj.orderId = index;
                                    newCollection.push(obj);
                                });

                                // Update complete, loaded all items
                                if (newCollection.length == numItems) {
                                    self.freshen(0, numItems, newCollection);

                                    subsetCollection = self.getSubset(0, numItems);
                                    subsetCollection = new self.constructor(subsetCollection.models, {
                                        model: self.model
                                    });
                                    
                                    success.call(this, subsetCollection, self);
                                    return subsetCollection;
                                }
                            } 
                        });  
                    })(i);
                }
                return;
            } else {
                $.ajax({
                    type: 'GET',
                    url:  self.url(),
                    data: $.extend({}, data, {
                        offset: from,
                        limit: to
                    }),
                    dataType: 'json',
                    success: function (data) {
                        var newSubset = null;
                        if (data instanceof Object) {
                            newSubset = self.parse(data);
                        } else {
                            newSubset = self.parse(JSON.parse(data));
                        }

                        var options = _.clone(self.options);
                        var newSubsetCollection = new self.constructor(newSubset, options);

                        success.call(this, newSubsetCollection, self);
                        return newSubsetCollection;
                    },
                    error: function(e) {
                        error.call(this, e, self);
                    }
                });
            }
        },

        getSubset: function(from, to) {
            var subset = [];
            this.each(function(model) {
                if (model.get("orderId") != null && model.get("orderId") >= from && model.get("orderId") < to) {
                    subset.push(model);
                }
            });

            return new Backbone.Collection(subset);
        },

        freshen: function(from, to, objects) {
            from = typeof from !== 'undefined' ? from : 0;
            to = typeof to !== 'undefined' ? to : 20;

            var model;
            var self = this;
            var subset = [];

            // get subset of parent collection
            for (var i = from; i < to; i++) {
                if (typeof self.at(i) != "undefined") {
                    subset.push(self.at(i));
                }
            }

            // remove old models which aren't in new subset
            if (subset.length > 0) {
                _(subset).each(function(model) {
                    var findModel = _(_.where(objects, {id: model.id})).first();
                    if (typeof findModel == "undefined") {
                        // console.log("Removing: "+model.get("name"));
                        this.remove(model);
                    }
                }, this);
            }

            // add new models and set attributes if already exists
            _(objects).each(function(attrs) {
                if (subset.length > 0) {
                    model = this.get(attrs.id);
                    if (model) {
                        console.log("Updating attributes: "+attrs.name);
                        // console.log("OrderID: "+attrs.orderId);
                        model.set(attrs); // existing model
                    } else {
                        console.log("Adding new item: "+attrs.name);
                        // console.log("OrderID: "+attrs.orderId);
                        this.add(attrs);
                    }
                } else {
                    this.add(attrs); // if init collection is empty
                }
            }, this);
        }
    });
    return UpdatableCollection;
})