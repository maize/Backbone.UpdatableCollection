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

            var subsetCollection = this.getSubset(from, to);

            if (!forceUpdate && subsetCollection.length > 0 && subsetCollection.length == (to-from)) {
                console.log("Found subset..");
                success.call(this, subsetCollection, self);
                return subsetCollection;
            } else if (updateSubset) {
                console.log("Update subset..");
                console.log("From: "+from);
                console.log("To: "+to);

                additionalData = {
                    offset: from,
                    limit: to
                }

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

                        subsetCollection = self.getSubset(from, to);
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
                console.log("From: "+0);
                console.log("To: "+numItems);

                var newCollection = [];

                for (var i=0; i<numItems; i = (i+1)*limit) {
                    console.log("Updating from "+i+" to "+numItems);
                    $.ajax({
                        type: 'GET',
                        url:  self.url(),
                        data: $.extend({}, data, {
                            offset: 0,
                            limit: maxLimit
                        }),
                        dataType: 'json',
                        success: function (data) {
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

                            if (newCollection.length >= numItems) {
                                self.freshen(0, numItems, newCollection);

                                subsetCollection = self.getSubset(0, numItems);
                                success.call(this, subsetCollection, self);
                                return subsetCollection;
                            }
                        },
                        error: function(e) {
                            error.call(this, e, self);
                        }
                    });
                }
                return;
            }
        },

        getSubset: function(from, to) {
            var subset = [];
            this.each(function(model) {
                if (model.get("orderId") >= from && model.get("orderId") < to) {
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
                this.remove(model);
              }
            }, this);
          }

          // add new models and set attributes if already exists
          _(objects).each(function(attrs) {
            if (subset.length > 0) {
              model = this.get(attrs.id);
              if (model) {
                // console.log("Updating attributes: "+attrs.name);
                model.set(attrs); // existing model
              } else {
                // console.log("Adding new item: "+attrs.name);
                this.add(attrs, {
                  at: from+_(objects).indexOf(model)
                });
              }
            } else {
              this.add(attrs); // if init collection is empty
            }
          }, this);
        }
    });
    return UpdatableCollection;
})