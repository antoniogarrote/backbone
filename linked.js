(function(){

    // Initial Setup
    // -------------

    // Save a reference to the global object (`window` in the browser, `exports`
    // on the server).
    var root = this;

    if(typeof Backbone === 'undefined')
        console.log("* LinkedBackbone [Error] Backbone not detected")

    // Namespace for all Semantic Backbone function
    Backbone.Linked = {};

    // Initializes the Linked Backbone framework
    Backbone.Linked.bootstrap = function() {

        // A null value URI
        var RDF_NULL = "http://www.w3.org/1999/02/22-rdf-syntax-ns#null"

        var args = Array.prototype.slice.call(arguments), cb, options;
        if(args.length === 1) {
            cb = args[0];
        } else {
            cb = args[1];
            options = args[0];
        }
        rdfstore.create(function(store) {

            // Backbone.Linked.RDFStore
            // -------------------------
           
            // Setting the store object as a global property.
            var RDFStore = Backbone.Linked.RDFStore = store;


            // Backbone.Linked.registerNamespaces
            // ----------------------------------

            // Register namespaces for the application.
            Backbone.Linked.registerNamespaces = function(mapping) {
                Backbone.Linked.RDFStorage.namespaces.addAll(mapping);
                RDFStore.registerDefaultProfileNamespaces();
            };


            // Backbone.Linked.RDFStorage
            // --------------------------
            
            // RDFStorage objects are linked to some RDF node in the 
            // application RDF graph.
            // Notifications about changes in RDF node will be notified
            // to the associated object.
            var RDFStorage = Backbone.Linked.RDFStorage = {
                nodeListeners: {},
                queryListeners: {},

                // Mapping of namespaces for the RDF Storage layer
                namespaces: store.rdf.prefixes,

                // Starts notifying changes for the provided node URI associating the callback
                // the the provided ID.
                // If a callback is already associated to the provided ID, the callback is 
                // deregsitered and the new callback registered.
                // Arguments:
                // - id: ID of the callback associated to this node.
                // - nodeURI: URI of the node to observe.
                // - callback: Function to be invoked when changes on the node happen.
                startObservingNode: function(id,nodeURI,callback) {
                    var listenerData = this.nodeListeners[id];
                    var uri = this.namespaces.safeResolve(nodeURI);
                    if(listenerData !== undefined) {
                        store.stopObservingNode(listenerData.callback);
                    }
                    // Transform JSInterface into a plain JSON object
                    // before invoking the callback.
                    var wrapperCb = function(node){
                        var node = jsIntefaceToJSON(uri, node);
                        callback(node);
                    };
                    listenerData = {
                        uri: uri,
                        callback: wrapperCb
                    };
                    this.nodeListeners[id] = listenerData;
                    store.startObservingNode(uri, wrapperCb);
                },

                // Stops notifying changes to the callback associated to the provided ID.
                stopObservingNode: function(id) {
                    var listenerData = this.nodeListeners[id];
                    if(listenerData !== undefined) {
                        store.stopObservingNode(listenerData.callback);
                        delete this.nodeListeners[id];
                    }
                },

                
                // Starts notifying changes for the results of a SPARQL query.
                // Arguments are:
                // - id: ID for the query.
                // - query: String or Object BGP query to update.
                // - [options]: Optional map of options: limit and order.
                // - callback: Callback to be invoked qhen new results are available.
                startObservingQuery: function() {
                    var args = Array.prototype.slice.call(arguments), cb, options;                    
                    var id, query, options, callback;
                    if(args.length === 3) {
                        id = args[0];
                        query = args[1];
                        options = {};
                        callback = args[2];
                    } else {
                        id = args[0];
                        query = args[1];
                        options = args[2]
                        callback = args[3];
                    }

                    var listenerData = this.queryListeners[id];
                    if(listenerData !== undefined) {
                        store.stopObservingQuery(listenerData.callback);
                    }

                    // Transform a tuple with RDF value objects into a plain JSON object
                    // before invoking the callback.
                    var wrapperCb = function(nodes){
                        nodes = _.map(nodes, function(node) {
                            return _.reduce(_.keys(node), function(acc,k) {
                                acc[k] = literalToJSON(acc[k]);
                                return acc;
                            }, node); 
                        });
                        callback(nodes);
                    };
              

                    query = queryObjectToQueryString(query, options);
                    listenerData = {
                        query: query,
                        options: options,
                        callback: wrapperCb
                    };
                    this.queryListeners[id] = listenerData;
                    
                    store.startObservingQuery(query, wrapperCb);
                },

                // Stops notifying changes for the associated query callback ID.
                stopObservingQuery: function(id) {
                    var listenerData = this.queryListeners[id];
                    if(listenerData !== undefined) {
                        store.stopObservingQuery(listenerData.callback);
                        delete this.queryListeners[id];
                    }
                },

                // Modifies a single node provided its URI and the new
                // node N3 data using an SPARQL UPDATE DELETE/INSERT/WHERE query
                // to update the node in the store;
                modifyNode: function(uri, n3Data) {
                    var query =  "DELETE { <"+uri+"> ?p ?o } INSERT { "+n3Data+" } WHERE { <"+uri+"> ?p ?o }";
                    RDFStore.execute(query);
                },

                // Write the information about a node into the store using
                // a RDF INSERT DATA query.
                writeNode: function(uri, n3Data) {
                    var query =  "INSERT DATA { "+n3Data+" }";
                    RDFStore.execute(query);
                },

                // Removes some properties for a RDF node
                removePropertiesFromNode: function(uri, properties) {
                    var conditions = _.map(properties, function(prop) {
                        return "?p = <"+prop+">";
                    }).join(" || ");
                    var query =  "DELETE { <"+uri+"> ?p ?o } WHERE { <"+uri+"> ?p ?o . FILTER("+conditions+") }";
                    RDFStore.execute(query);
                },

                // Removes a single node from the RDF graph using a DELETE query
                unlinkNode: function(uri) {
                    var query =  "DELETE { ?s ?p ?o } WHERE { ?s ?p ?o . FILTER( ?s = <"+uri+"> || ?o = <"+uri+">) }";
                    RDFStore.execute(query);
                },

                // Events methods

                on: function(name, callback, context) {
                    name = normalizeNameEvent(name);
                    return Backbone.Events.on.apply(this, [name, callback, context])
                },

                once: function(name, callback, context) {
                    name = normalizeNameEvent(name);
                    return Backbone.Events.once.apply(this, [name, callback, context])
                },

                off: function(name, callback, context) {
                    name = normalizeNameEvent(name);
                    return Backbone.Events.off.apply(this, [name, callback, context])
                },

                trigger: function(name) {
                    name = normalizeNameEvent(name);
                    var args = Array.prototype.slice.call(arguments,1);
                    args.unshift(name);
                    return Backbone.Events.trigger.apply(this,args);
                },

                stopListening: function(obj, name, callback) {
                    name = normalizeNameEvent(name);                    
                    return Backbone.Events.stopListening.apply(this,[obj, name, callback]);
                },

                listenTo: function(obj, name, callback) {
                    name = normalizeNameEvent(name);                    
                    return Backbone.Events.listenTo.apply(this,[obj, name, callback]);
                },

                listenToOnce: function(obj, name, callback) {
                    name = normalizeNameEvent(name);                    
                    return Backbone.Events.listenToOnce.apply(this,[obj, name, callback]);
                },

                mixinListerMethods: function(prototype) {
                    _.each(['on', 'once', 'off', 'trigger', 'stopListening', 'listenTo', 'listenToOnce'], 
                           function(method) {
                               prototype[method] = RDFStorage[method];
                           });
                }
            };

            // Helper functions to work with RDF prefixes.

            // Normalize parts of an event name
            var normalizeNameEvent = function(name) {
                var parts = name.split(":");
                var resolved = [];
                for(var i=0; i<parts.length; i++) {
                    var nextComp = parts[i]+":"+(parts[i+1]||"");
                    if(RDFStorage.namespaces.resolve(nextComp) != null) {
                        resolved.push(RDFStorage.namespaces.resolve(nextComp));
                        i++;
                    } else {
                        resolved.push(parts[i]);
                    }
                }
                return resolved.join(":");
            };

            // Registers a new prefix for a given namespace.
            RDFStorage.namespaces.register = function(namespace,prefix) {
                store.registerDefaultNamespace(namespace, prefix)
            };

            // Unregisters an already registered namespace.
            RDFStorage.namespaces.unregister = function(namespace) {
                RDFStorage.namespaces.remove(namespace);
                delete RDFStore.engine.defaultPrefixes[namespace];
            };

            // Resolves a provided URI or CURIE. If no resolution can be computed,
            // the provided string is returned as it was passed.
            RDFStorage.namespaces.safeResolve = function(URIiOrCURIE) {
                return (RDFStorage.namespaces.resolve(URIiOrCURIE) || URIiOrCURIE);
            };

            // Private helper functions 
            
            // Function to build JSON Objects from RDFJSInterfaces API graphs
            var jsIntefaceToJSON = function(subjectURI,node) {
                return _.reduce(node.toArray(), function(acc, triple) {
                    if(triple.subject.valueOf() === subjectURI) {
                        var value = acc[triple.predicate.valueOf()], object;

                        if(triple.object.interfaceName !== 'literal') {
                            object = {type: 'uri',
                                      value:  triple.object.valueOf()};
                        } else {
                            obje = triple.object.valueOf();
                        }
                        if(value === undefined) {
                            acc[triple.predicate.valueOf()] = triple.object.valueOf();
                        } else if(value.prototype === Array) {
                            value.push(triple.object.valueOf());
                        } else {
                            acc[triple.predicate.valueOf()] = [value, triple.object.valueOf()]
                        }
                    }
                    return acc;
                },{});
            };

            // Function that parses a BGP query pattern into a proper SPARQL query.
            var queryObjectToQueryString = function(query, options) {
                var queryString, orderBy = options.order, limit = options.limit, offset = options.offset;

                if(typeof(query) !== 'string') {
                    // var queryString = "";
                    // var property, object;
                    // for(var key in query) {
                    //     
                    //     if(key.indexOf("?") === 0) {
                    //         property = key;
                    //     } else {
                    //         property = "<"+RDFStorage.namespaces.safeResolve(key)+">";
                    //     }
                    //  
                    //     if(typeof(object
                    // }
                    throw("Not string queries are not supported yet");
                } else {
                    if(query.toLowerCase().match(/^\s*select/i) === null)
                        queryString = "SELECT * "+query;
                    else
                        queryString = query;
                }

                if(orderBy !== undefined)
                    queryString = queryString + " ORDER BY " + orderBy;
                if(limit !== undefined)
                    queryString = queryString + " LIMIT " + limit;
                if(offset !== undefined)
                    queryString = queryString + " OFFSET " + offset;

                return queryString;
            };

            // Transforms a N3 literal into a JS Object.
            var literalToJSON = function(object) {
                if(object.token !== 'literal' && object.value === RDF_NULL) {
                    return null;
                } else if(object.token !== 'literal') {
                    return object
                } else if(object.type === "http://www.w3.org/2001/XMLSchema#float") {
                    object = parseFloat(object.value);
                } else if(object.type === "http://www.w3.org/2001/XMLSchema#integer") {
                    object = parseInt(object.value);
                } else if(object.type === "http://www.w3.org/2001/XMLSchema#boolean") {
                    object = (object.value === "true") ? true : false;
                } else if(object.type === "http://www.w3.org/2001/XMLSchema#dateTime") {
                    object = new Date(object.value);
                }
                return object;
            };


            // Returns a N3 representation of the JS object for a provided URI.
            var JSONToNT = function(uri, attributes) {
                // We're using RDF JS Interface to build
                // a N3 representation from the attributes;
                var graph = RDFStore.rdf.createGraph();
                var subject = RDFStore.rdf.createNamedNode(uri);
                var triple, object;
                _.each(_.keys(attributes),function(property){
                    if(property === '@id')
                        return;
                    object = attributes[property];
                    if(object.constructor === Array) {
                        _.each(modelAttributeValueToN3(object), function(object) {
                            graph.add(RDFStore.rdf.createTriple(
                                subject,
                                RDFStore.rdf.createNamedNode(property),
                                object
                            ));
                        });
                    } else {
                        graph.add(RDFStore.rdf.createTriple(
                            subject,
                            RDFStore.rdf.createNamedNode(property),
                            modelAttributeValueToN3(object)
                        ));
                    }
                });
                
                return graph.toNT();
            };




            // Backbone.Linked.Model
            // ---------------------

            //A Backbone model whose state is bound to the state
            //of a RDF node stored in the local graph and that can
            //sync his local state to a remote LDP Resource
            var LinkedModel = Backbone.Linked.Model = Backbone.Model.extend({

                constructor: function(data, options) {
                    // By default the data will not be initialized until state
                    // is read from the RDF store
                    this.initialized = false;

                    if(typeof(data) === 'object') {
                        this.uri = data['@id'] || nextAnonModelURI();
                        data['@id'] = this.uri;

                        // We're pushing data into the store, not receiving an update from the store
                        this.rdfPushed = false;

                        // Default Backbone constructor
                        Backbone.Model.apply(this,[data,options]);
                    } else {
                        // The URI of the associated node is provided in the data
                        this.uri = RDFStorage.namespaces.safeResolve(data);

                        // We're expecting for the store to send us the data
                        this.rdfPushed = true;

                        // Default Backbone constructor
                        Backbone.Model.apply(this,[{},options]);
                    }

                    // We start observing the RDF node status
                    var that = this;
                    RDFStorage.startObservingNode(this.cid, this.uri, function(node) {
                        var shouldInitialize = false;

                        // Sets the ID to point to the URI;
                        node['@id'] = that.uri
                        if(that.initialized === false) {
                            that.initialized = true;
                            shouldInitialize = true;
                        }

                        var toSetAttrs = {};
                        var toUnsetAttrs = {};
                        var mustSet = false;
                        var mustUnset = false;
                        _.each(_.unique(_.keys(node).concat(_.keys(that.attributes))), function(prop) {
                            if(node[prop] !== undefined) {
                                mustSet = true;
                                toSetAttrs[prop] = node[prop];
                            } else {
                                mustUnset = true;
                                toUnsetAttrs[prop] = that.attributes[prop];
                            }
                        });

                        if(mustSet) {
                            that.rdfPushed = true;
                            that.set(toSetAttrs);
                        }
                        if(mustUnset) {
                            that.rdfPushed = true;
                            that.unset(toUnsetAttrs);
                        }

                        // triggers the rdf:initialized event
                        if(shouldInitialize) 
                            that.trigger('rdf:initalized',this,node);
                    });
                },

                // JSON-LD style
                idAttribute: '@id',
                
                // The implementation of this method should be proxied
                // to the LDPResource module when implemented
                sync: function() {
                    throw("LDPResource sync is not implemented yet");
                },

                // Wrap Backbone.Model implementation normalizing the
                // property name.
                get: function(property) {
                    property = RDFStorage.namespaces.safeResolve(property);
                    return Backbone.Model.prototype.get.call(this,property);
                },

                // Wrap Backbone.Model implementation, normalizing the
                // property names and triggering the insertion into 
                // the RDFStore.
                // @todo: deal with options
                set: function(key,val,options) {
                    var attrs, rdfAttrs, allprops, that = this;
                    if (key == null) return this;

                    // Handle both `"key", value` and `{key: value}` -style arguments.
                    if (typeof key === 'object') {
                        attrs = key;
                        options = (val || options);
                    } else {
                        (attrs = {})[key] = val;
                    }


                    attrs = _.reduce(_.keys(attrs), function(acc,prop) {
                        acc[RDFStorage.namespaces.safeResolve(prop)] = attrs[prop];
                        return acc;
                    }, {});

                    // Only update the store if we're pushing the data
                    // from the model to the store and not
                    // and not updating after a store notification.
                    if(this.rdfPushed === false) {

                        if((options||{}).unset === true) {
                            // Performing RDF graph update.
                            this.removePropertiesFromNode(that.uri, _.keys(attrs));
                        } else {
                            allprops = _.unique(_.keys(attrs).concat(_.keys(this.attributes)));
                            // rdfAttrs should have the same value than attributes after
                            // invoking backbone set implementation
                            rdfAttrs = _.reduce(allprops, function(acc, prop) {
                                var val = (attrs[prop] || that.attributes[prop]);
                                acc[prop] = val;
                                return acc;
                            },{});

                            
                            // Performing RDF graph update.
                            this.modify(rdfAttrs);
                        }
                    }

                    // Invoking original 'set' Backbone.Model.
                    Backbone.Model.prototype.set.apply(this,[attrs,options]);

                    // reset the rdfPushed flag
                    this.rdfPushed = false;
                },

                // Updates the representation of the node in the store.
                modify: function() {
                    var attrs = arguments[0] || this.attributes;
                    if(this.initialized === true) 
                        RDFStorage.modifyNode(this.uri, JSONToNT(this.uri, attrs));
                    else
                        RDFStorage.writeNode(this.uri, JSONToNT(this.uri, attrs));
                },

                // Removes the representation of the node from the store
                remove: function() {
                    RDFStorage.unlinkNode(this.uri);
                },
                
                // Should match the URI of the Linked Resource
                url: function() {
                    return this.uri;
                }

            });

            // Mixin RDFStorage listener methods
            RDFStorage.mixinListerMethods(LinkedModel.prototype);

            // Private Linked Model helper functions

            // Anon models URI generator;
            var anonModelCounter = 0;
            var nextAnonModelURI = function() {
                anonModelCounter++;
                return "http://linked.backbone.org/models/anon#"+anonModelCounter;
            };
            
            var modelAttributeValueToN3 = function(value) {
                if(value === null) {
                    return RDFStore.rdf.createNamedNode(RDF_NULL)
                } else if(value === undefined) {

                } else if(value.constructor === Array) {
                    return _.map(value,function(value) {
                        return modelAttributeValueToN3(value);
                    });
                } else if(value.constructor === Date) {
                    return RDFStore.rdf.createLiteral(iso8601(value), null, "http://www.w3.org/2001/XMLSchema#dateTime");
                } else if(typeof(value) === 'object' && value.type === 'uri') {
                    value = RDFStorage.namespaces.safeResolve(value.value);
                    return RDFStore.rdf.createNamedNode(value);
                } else if(typeof(value) === 'object' && value.type === 'literal') {
                    return RDFStore.rdf.createLiteral(value.value, null, value.type);
                } else if(typeof(value) === 'number') {
                    if(isInt(value)) {
                        return RDFStore.rdf.createLiteral(value, null, "http://www.w3.org/2001/XMLSchema#integer");
                    } else if(value === true) {
                        return RDFStore.rdf.createLiteral(true, null, "http://www.w3.org/2001/XMLSchema#boolean");
                    } else if(value === false) {
                        return RDFStore.rdf.createLiteral(false, null, "http://www.w3.org/2001/XMLSchema#boolean");
                    } else {
                        return RDFStore.rdf.createLiteral(value, null, "http://www.w3.org/2001/XMLSchema#float");
                    }
                } else if(typeof(value) === 'string') {
                    return RDFStore.rdf.createLiteral(value);
                } else {
                    throw("Unsupported RDF value for property "+value);
                }
            };

            var isInt = function(n) {
                return typeof n === 'number' && parseFloat(n) == parseInt(n, 10) && !isNaN(n);
            };

            var iso8601 = function(date) {
                function pad(n){
                    return n<10 ? '0'+n : n;
                }    
                return date.getUTCFullYear()+'-'
                    + pad(date.getUTCMonth()+1)+'-'
                    + pad(date.getUTCDate())+'T'
                    + pad(date.getUTCHours())+':'
                    + pad(date.getUTCMinutes())+':'
                    + pad(date.getUTCSeconds())+'Z';
            };


            // Backbone.Linked.Collection
            // ---------------------

            // LinkedCollections are Backbone collections that are
            // bound to an specific SPARQL query.
            // Unlike Backbone default collections, LinkedCollections
            // do not offer interface methods for adding or removing
            // models to the collection, but they will grow or shrink
            // authomatically as the properties of the RDF graph are 
            // modified or new nodes are added or removed from the graph.
            var LinkedCollection = Backbone.Linked.Collection = Backbone.Collection.extend({
                constructor: function(query, options) {
                    this.generator = query;
                    options = (options||{});
                    this.idVariable = options['idVariable'] || "id";
                    this.cid = "collection:"+nextAnonModelURI().split("#")[1];

                    // LinkedModel by default
                    options.model = options.model || LinkedModel;
                    var that = this;

                    Backbone.Collection.apply(this,[[],options]);

                    RDFStorage.startObservingQuery(this.cid, this.generator, options, function(nodes) {
                        var models = _.map(nodes, function(node) {
                            var uri = node[that.idVariable].value;
                            return new that.model(uri)
                        });

                        that.set(models, {merge:false})
                    });
                }
                
            });

            // Instantiates the collection for the provided
            // query. Just an alias for new.
            LinkedCollection.where = function(query, options) {
                return new this(query, options);
            };

            // Mixin RDFStorage listener methods
            RDFStorage.mixinListerMethods(LinkedCollection.prototype);


            // Finishing
            // ---------
            
            // Invoke the callback after initialization
            if(cb != null)
                cb(true); 
        });
    }; // end of Backbone.Linked.bootstrap

}).call(this);
