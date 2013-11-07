(function(){

    // Initial Setup
    // -------------

    if(typeof Backbone === 'undefined')
        console.log("* LinkedBackbone [Error] Backbone not detected");

    // Namespace for all Semantic Backbone function
    Backbone.Linked = {};

    // Initializes the Linked Backbone framework
    Backbone.Linked.bootstrap = function() {

        // A null value URI
        var RDF_NULL = "http://www.w3.org/1999/02/22-rdf-syntax-ns#null";

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
                    var id, query, callback;
                    if(args.length === 3) {
                        id = args[0];
                        query = args[1];
                        options = {};
                        callback = args[2];
                    } else {
                        id = args[0];
                        query = args[1];
                        options = args[2];
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
                modifyNode: function(uri, properties) {
                    var conditions = _.map(_.keys(properties), function(prop) {
                        return "?p = <"+prop+">";
                    }).join(" || ");
                    var n3Data = JSONToNT(uri, properties)
                    // Doing this in two queries
                    var query =  "DELETE { <"+uri+"> ?p ?o } WHERE { <"+uri+"> ?p ?o . FILTER("+conditions+") }";
                    RDFStore.execute(query);
                    var query =  "INSERT DATA { "+n3Data+" }";
                    RDFStore.execute(query);
                },


                writeNodesProperties: function(uris, properties) {
                    if(uris.constructor !== Array) {
                        uris = [uris];
                        properties = [properties];
                    }
                    var acum = [];
                    for(var i=0; i<uris.length; i++) {
                        acum.push(JSONToNT(uris[i],properties[i]));
                    }
                    var query = "INSERT DATA { "+acum.join("\n")+" }";
                    RDFStore.execute(query);
                },

                deleteNodesProperties: function(uris, properties) {
                    if(uris.constructor !== Array) {
                        uris = [uris];
                        properties = [properties];
                    }

                    var acum = [];
                    for(var i=0; i<uris.length; i++) {
                        acum.push(JSONToNT(uris[i],properties[i]));
                    }
                    var query = "DELETE DATA { "+acum.join("\n")+" }";
                    RDFStore.execute(query);
                },

                // Removes some properties for a RDF node
                removePropertiesFromNode: function(uri, properties) {
                    var conditions = _.map(_.keys(properties), function(prop) {
                        return "?p = <"+prop+">";
                    }).join(" || ");
                    var query =  "DELETE { <"+uri+"> ?p ?o } WHERE { <"+uri+"> ?p ?o . FILTER("+conditions+") }";
                    RDFStore.execute(query);
                },

                // Removes some properties for a RDF node
                changeNodeUri: function(oldUri, newUri) {
                    var query =  "DELETE { <"+oldUri+"> ?p ?o } INSERT { <"+newUri+"> ?p ?o } WHERE { <"+oldUri+"> ?p ?o }";
                    RDFStore.execute(query);
                    var query =  "DELETE { ?s ?p <"+oldUri+"> } INSERT { ?s ?p <"+newUri+"> } WHERE { ?s ?p <"+oldUri+"> }";
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
                    return Backbone.Events.on.apply(this, [name, callback, context]);
                },

                once: function(name, callback, context) {
                    name = normalizeNameEvent(name);
                    return Backbone.Events.once.apply(this, [name, callback, context]);
                },

                off: function(name, callback, context) {
                    name = normalizeNameEvent(name);
                    return Backbone.Events.off.apply(this, [name, callback, context]);
                },

                trigger: function(name) {
                    var args = Array.prototype.slice.call(arguments,0);
                    var normalizedName = normalizeNameEvent(args.shift());
                    args.unshift(normalizedName);
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

            // Transforms an URI into a string that can be stored in the attributes hash of an object.
            var uriProp = function(uri) {
                return '@id:'+uri;
            };

            var propUri = function(value) {
                return RDFStorage.namespaces.safeResolve(value.split('@id:')[1]);
            };
            
            var isPropUri = function(value) {
                return typeof(value) === 'string' && value.match(/^@id:.+$/)
            }

            // Function to build JSON Objects from RDFJSInterfaces API graphs
            var jsIntefaceToJSON = function(subjectURI,node) {
                return _.reduce(node.toArray(), function(acc, triple) {
                    if(triple.subject.valueOf() === subjectURI) {
                        var value = acc[triple.predicate.valueOf()], object;

                        if(triple.object.interfaceName !== 'Literal') {
                            object = uriProp(triple.object.valueOf());
                        } else {
                            object = triple.object.valueOf();
                        }
                        if(value === undefined) {
                            acc[triple.predicate.valueOf()] = object;
                        } else if(value.prototype === Array) {
                            value.push(object);
                        } else {
                            acc[triple.predicate.valueOf()] = [value, object];
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
                    return object;
                } else if(object.type === "http://www.w3.org/2001/XMLSchema#float") {
                    object = parseFloat(object.value);
                } else if(object.type === "http://www.w3.org/2001/XMLSchema#integer") {
                    object = parseInt(object.value);
                } else if(object.type === "http://www.w3.org/2001/XMLSchema#boolean") {
                    object = (object.value === "true") ? true : false;
                } else if(object.type === "http://www.w3.org/2001/XMLSchema#dateTime") {
                    object = new Date(object.value);
                } else if(object.token === 'uri') {
                    object = uriProp(object.value);
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
                    options = options || {};

                    // By default the data will not be initialized until state
                    // is read from the RDF store
                    this.initialized = false;

                    if(typeof(data) === 'object') {
                        this.uri = data['@id'] || nextAnonModelURI();
                        data['@id'] = this.uri;

                        // Look into the cache for instances of this object;
                        if(LinkedModel.cache.fetch(this.uri))
                            return LinkedModel.cache.fetch(this.uri);

                        // We're pushing data into the store, not receiving an update from the store
                        this.rdfPushed = false;

                        // Default Backbone constructor
                        Backbone.Model.apply(this,[data,options]);
                        LinkedModel.cache[this.uri] = this;
                    } else {
                        // The URI of the associated node is provided in the data
                        this.uri = RDFStorage.namespaces.safeResolve(data);

                        // Look into the cache for instances of this object;
                        if(LinkedModel.cache.fetch(this.uri))
                            return LinkedModel.cache.fetch(this.uri);

                        // We're expecting for the store to send us the data
                        this.rdfPushed = true;

                        // Default Backbone constructor
                        Backbone.Model.apply(this,[{},options]);
                    }

                    // Sets the container if passed as an argument
                    this.container = options.container;

                    // We start observing the RDF node status
                    var that = this;
                    this.syncRDFNodeCallback = function(node) {
                        var shouldInitialize = false;

                        // Sets the ID to point to the URI;
                        node['@id'] = that.uri;
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
                    };
                    RDFStorage.startObservingNode(this.cid, this.uri,this.syncRDFNodeCallback);

                    // Save in the cache
                    LinkedModel.cache[this.uri] = this;
                },

                // JSON-LD style
                idAttribute: '@id',

                // Method that changes the URI of the resource, (maybe after being persisted
                // in a container.
                mutate: function(newUri) {
                    var oldUri = this.uri
                    this.uri = RDFStorage.namespaces.safeResolve(newUri);
                    delete LinkedModel.cache.remove(oldUri);

                    // We're expecting for the store to send us the data
                    this.rdfPushed = true;

                    RDFStorage.stopObservingNode(this.cid);
                    RDFStorage.changeNodeUri(oldUri, this.uri);
                    RDFStorage.startObservingNode(this.cid, this.uri,this.syncRDFNodeCallback);

                    LinkedModel.cache[this.uri] = this;
                },
                
                // The implementation of this method should be proxied
                // to the LDPResource module when implemented
                sync: function() {
                    return LDPResource.sync.apply(this, arguments);
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
                            this.removePropertiesFromNode(that.uri, attrs);
                        } else {
                            // Performing RDF graph update.
                            this.modify(attrs);
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
                        RDFStorage.modifyNode(this.uri, attrs);
                    else
                        RDFStorage.writeNodesProperties(this.uri, attrs);
                },

                // Removes the representation of the node from the store
                remove: function() {
                    RDFStorage.unlinkNode(this.uri);
                },
                
                // Should match the URI of the Linked Resource
                url: function() {
                    if(this.isNew()) {
                        if(this.container) {
                            return this.container;
                        } else if(this.collection && this.collection.url()) {
                            return this.collection.url();
                        }
                    } else {
                        return this.uri;
                    }
                },

                // Asynchronous version of the Backbone.Model parse function
                fetch: function(options) {
                    options = options ? _.clone(options) : {};
                    if (options.parse === void 0) options.parse = true;
                    var model = this;
                    var success = options.success;
                    options.success = function(resp) {
                        options.parseCallback = function(result, node) {
                            if(result) {
                                model.syncRDFNodeCallback(node);
                                success(model, resp, options);
                                model.trigger('sync', model, resp, options);
                            }
                        }
                        model.parse(resp, options)
                    };
                    wrapError(this, options);
                    return this.sync('read', this, options);
                },

                destroy: function(options) {
                    var oldSuccess = options.success;
                    var model = this;
                    options.success = function(resp) {
                        LinkedModel.cache.remove(model.uri);
                        RDFStorage.unlinkNode(model.uri);
                        if(oldSuccess) oldSuccess(resp);
                    };
                    Backbone.Model.prototype.destroy.call(this, options);
                },

                parse: function(resp, options) {
                    if(typeof(resp) === 'string') {
                        resp = resp.replace(/\<\>/g,"<"+this.uri+">");
                        var model = this;
                        rdfstore.create(function(g){
                            var result, uri;
                            var accum = {};
                            // @todo: check parser for media type
                            g.load("text/n3", resp, function(success, results) {
                            // g.execute("SELECT DISTINCT ?s { ?s ?p ?o }", function(success, results) {
                            //     _.each(results, function(tuple) {
                            //         uri = tuple['s'].value;
                            //         g.node(uri, function(graph) {
                            //             accum[uri] = graph;
                            //         });
                            //     });
                            // });
                                g.node(model.uri, function(res, node){
                                    if(res) {
                                        if(options && options.parseCallback) 
                                            options.parseCallback(res, jsIntefaceToJSON(model.uri, node));
                                    } else if(options && options.parseCallback) {
                                        options.parseCallback(res, node);
                                    }
                                });
                            });
                        });
                    } else {
                        if(options.parseCallback) {
                            options.parseCallback(true, resp);
                        } else {
                            return resp;
                        }
                    }
                },

                // A model is new if it has never been saved to the server, and lacks an id.
                isNew: function() {
                    return this.id == null || isAnonModelURI(this.uri);
                },

                toNT: function(options) {
                    options = options || {};
                    var subject;
                    if(options.anonymous === true)
                        subject = "";
                    else
                        subject = this.uri;
                    return JSONToNT(subject, this.attributes);
                }
            });

            // Mixin RDFStorage listener methods
            RDFStorage.mixinListerMethods(LinkedModel.prototype);

            // LinkedModels cache
            LinkedModel.cache = {};
            LinkedModel.cache.fetch = function(uri) {
                return LinkedModel.cache[uri];
            };
            LinkedModel.cache.remove = function(uri) {
                delete LinkedModel.cache[uri];
            };

            // Private Linked Model helper functions

            // Anon models URI generator;
            var anonURIPrefix = "http://linked.backbone.org/models/anon#";
            var anonModelCounter = 0;
            var isAnonModelURI = function(uri) {
                return uri.indexOf(anonURIPrefix) === 0;
            };

            var nextAnonModelURI = function() {
                anonModelCounter++;
                return anonURIPrefix+anonModelCounter;
            };
            
            var modelAttributeValueToN3 = function(value) {
                if(value === null) {
                    return RDFStore.rdf.createNamedNode(RDF_NULL);
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
                } else if(typeof(value) === 'string' && value.match(/^@val:\"(.+)\"\^\^\<(.+)\>$/)) {
                    value = value.match(/\"(.+)\"\^\^\<(.+)\>$/);
                    return RDFStore.rdf.createLiteral(value[1], null, value[2]);
                } else if(isPropUri(value)) {
                    value = propUri(value);
                    return RDFStore.rdf.createNamedNode(value);
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

                constructor: function() {
                    var values, options;
                    if(arguments.length === 1 && arguments[0].constructor === Array) {
                        values = arguments[0];
                        options = {};
                    } else if(arguments.length === 1) {
                        values = [];
                        options = arguments[0];
                    } else {
                        values = arguments[0];
                        options = arguments[1];
                    }

                    options = (options||{});

                    // Sets the container if passed as an argument
                    this.container = options['container'];

                    // Variable name used to identify the variable
                    // matching the nodes belonging to this collection.
                    this.uri = options['uri'] || nextAnonModelURI();
                    this.cid = "collection:"+nextAnonModelURI().split("#")[1];

                    cleanGenerator(this);
                    // Setup the right query
                    this.query = generatorToQuery.call(this,this.generator);

                    // We're pushing data into the store, not receiving an update from the store
                    this.rdfPushed = false;

                    // can the collection be updated?
                    this.isReadWrite = (typeof(this.generator) !== 'string');

                    // A model object that will maintain the triples for this collection/container resource
                    this.graph = setupGraphModel(this);

                    this.queryCallback = function(nodes) {
                        var models = _.map(nodes, function(node) {
                            var uri = node[that.idVariable].value;
                            return new that.model(uri);
                        });

                        that.rdfPushed = true;
                        that.set(models, {merge:false});
                        that.rdfPushed = false;
                    }

                    var collection = this;
                    this.graph.on('change', function(model) {
                        if(model.has('ldp:MembershipSubject')) {
                            collection.generator.subject = model.get('ldp:MembershipSubject');
                            collection.generator.predicate = model.get('ldp:MembershipPredicate');
                            collection.generator.object = model.get('ldp:Membershipject');

                            var newQuery = generatorToQuery(collection, collection.generator);
                            if(newQuery !== collection.generator) {
                                collection.query = newQuery;
                                RDFStorage.stopObservingQuery(collection.cid);
                                RDFStorage.startObservingQuery(collection.cid, collection.query, collection.options, collection.queryCallback);
                            }
                        }
                    });
                    // this.graph.on('sync', function(model,resp,options) {
                    //     collection.trigger('sync', collection, resp, options);
                    // });

                    var that = this;

                    Backbone.Collection.apply(this,[values,options]);

                    RDFStorage.startObservingQuery(this.cid, this.query, options, this.queryCallback);
                },

                // Add a model, or list of models to the set.
                // In our implementation, just add the membership
                // triple to the models if no present.
                add: function(models, options) {
                    if(!this.isReadWrite) throw new Error('Trying to insert in read-only Linked.Collection, non membership triple defined in the generator.');

                    var singular = !_.isArray(models);
                    models = singular ? (models ? [models] : []) : _.clone(models);

                    var collection = this;
                    models = _.map(models, function(model) {
                        return collection._prepareModel(model);
                    });

                    var subject,predicate,object,oldValue;
                    
                    
                    if(this.generator.subject === "<>" || this.generator.subject == this.uri) {
                        predicate = this.generator.predicate;
                        oldValue = collection.graph.get(predicate);
                        if(oldValue == null) {
                            collection.graph.set(predicate,_.map(models, function(model){ return uriProp(model.uri); }));
                        } else if(oldValue.constructor === Array) {
                            // There's already an array of values, look for new models to append
                            var toAdd = oldValue;
                            var origLength = toAdd.length;
                            _.each(models, function(model) {
                                if(!_.contains(toAdd,uriProp(model.uri)))
                                   toAdd.push(uriProp(model.uri));
                            });
                            if(toAdd.length !== origLength)
                                collection.graph.set(predicate,toAdd);
                        } else {
                            // Single value, look for URIs in the models to append
                            var toAdd = [oldValue];
                            _.each(models, function(model) {
                                if(uriProp(model.uri) !== oldValue) {
                                    toAdd.push(uriProp(model.uri));
                                }
                            });
                            if(toAdd.length !== 1) 
                                collection.graph.set(predicate,toAdd);
                        }
                    } else if(this.generator.subject === RDFStorage.namespaces.safeResolve('ldp:MemberSubject')) {
                        predicate = this.generator.predicate;
                        if(this.generator.object === "<>" || this.generator.object === collection.uri) {
                            object = uriProp(collection.uri);
                        } else {
                            object = uriProp(this.generator.object);
                        }

                        _.each(models, function(model) {
                            oldValue = model.get(predicate);
                            if(oldValue == null) {
                                model.set(predicate, object);
                            } else if(oldValue.constructor === Array && !_.contains(oldValue, object)) {
                                oldValue.push(object);
                                model.set(predicate, oldValue);
                            } else if(oldValue !== object){
                                // Append the new value
                                model.set(predicate,[oldValue,object]);
                            } // else -> already present.
                        });
                    }
                },

                // Remove a model, or a list of models from the set.
                remove: function(models, options) {
                    if(this.rdfPushed) {
                        this.rdfPushed = false;
                        return Backbone.Collection.prototype.remove.apply(this,[models,options]);
                    }
                    if(!this.isReadWrite) throw new Error('Trying to remove from read-only Linked.Collection, non membership triple defined in the generator.');
                    var singular = !_.isArray(models);
                    models = singular ? [models] : _.clone(models);
                    options || (options = {});
                    var collection = this;
                    models = _.map(models, function(model) {
                        if(typeof(model) === 'string') {
                            if(model.indexOf("@id:") === 0) {
                                model= new collection.model(RDFStorage.namespaces.safeResolve(model.split("@id:")[1]));
                            } else {
                                model= new collection.model(RDFStorage.namespaces.safeResolve(model));
                            }
                        }
                        return collection.get(model);
                    });
                    models = _.compact(models);
                    var predicate = this.generator.predicate;
                    if(this.generator.subject == null) {
                        var nodeToRemove = {};
                        var objectsToRemove = _.map(models, function(model) {
                            return uriProp(model.uri);
                        });
                        nodeToRemove[predicate] = objectsToRemove;
                        RDFStorage.deleteNodesProperties(this.uri, nodeToRemove);
                    } else {
                        if(this.generator.object === "<>" || this.generator.object === this.uri) {
                            object = uriProp(uri);
                        } else {
                            object = uriProp(this.generator.object);
                        }
                        var nodesToRemove = _.map(models, function(model) {
                            var node = {};
                            node[predicate] = object;
                            return node;
                        });
                        var urisToRemove = _.map(models, function(model){ return model.uri });
                        RDFStorage.deleteNodesProperties(urisToRemove, nodesToRemove);
                    }
                    return singular ? models[0] : models;
                },

                // Container methods

                // Captures successful execution to mutate the model after
                // invoking the Backbone.Model version of the create function
                create: function(model, options) {
                    var oldSuccess = options.success;
                    options.success = function(model, resp, options) {
                        var newModelUri = options.xhr.getResponseHeader("Location");
                        if(newModelUri == null)
                            throw new Error("The server notified a successful LDP Resource creation but si not returning the Location header");
                        model.mutate(newModelUri);
                        if(oldSuccess) oldSuccess(model, resp, options);
                    };
                    return Backbone.Collection.prototype.create.call(this, model, options);
                },

                // Overwrite fetch method in Backbone.Collection to parse metadata
                fetch: function(options){
                    var clientSuccess = options.success;
                    var collection = this;
                    options.success = function(resp) {
                        collection.trigger('sync', collection, resp, options);
                        if(clientSuccess) clientSuccess(resp);
                    };
                    this.graph.fetch(options);
                },

                // Saves or creates a representation of this collection as a LDP Container.
                save: function(options) { },

                destroy: function() { },

                isNew: function() { return isAnonModelURI(this.uri); },

                // Default values:
                
                idVariable: 'id',

                generator: {subject: "<>",
                            predicate:'rdfs:member', 
                            object:"ldp:MemberSubject"},

                model: LinkedModel,

                url: function() {
                    if(this.isNew()) {
                        if(this.container) {
                            return this.container;
                        } else if(this.collection && this.collection.container) {
                            return this.collection.container;
                        } else {
                            return null;
                        }
                    } else {
                        return this.uri;
                    }
                },


                // Internal method called every time a model in the set fires an event.
                _onModelEvent: function(event, model, collection, options) {
                    if ((event === 'add' || event === 'remove') && collection !== this) return;

                    // This should not be necessary. The model should already be removed
                    // due to store callback
                    //if (event === 'destroy') this.remove(model, options);

                    // This should not happen.
                    // If a model changes its ID by removing its old triples,
                    // the old model should already be removed from the collection
                    if (model && event === 'change:' + model.idAttribute) {
                        delete this._byId[model.previous(model.idAttribute)];
                        if (model.id != null) this._byId[model.id] = model;
                    }

                    // Still doing this.
                    this.trigger.apply(this, arguments);
                },

                toNT: function(options) {
                    options = options || {};
                    var subject;
                    if(options.anonymous === true)
                        subject = ""
                    else
                        subject = this.uri

                    if(this.isReadWrite) {
                        var attributes = {
                            'rdf:type': [uriProp(RDFStorage.namespaces.safeResolve('ldp:Container'))]
                        };
                        if(this.generator == null) {
                            attributes['ldp:membershipSubject'] = uriProp(subject);
                            attributes['ldp:membershipPredicate'] = uriProp(RDFStorage.namespaces.safeResolve(this.generator.predicate));
                            attributes['ldp:membershipObject'] = uriProp(RDFStorage.namespaces.safeResolve('ldp:MemberSubject'));
                        }
                        var modelsMembershipObjects = _.map(this.models, function(model) {
                            return model.uri;
                        });
                        attributes[this.generator.predicate] = modelsMembershipObjects;

                        return JSONToNT(subject, attributes);
                    } else {

                    }
                }
                
            });

            // Mixin RDFStorage listener methods
            RDFStorage.mixinListerMethods(LinkedCollection.prototype);


            // Private helper functions for LinkedCollections

            var wrapError = function(model, options) {
                var error = options.error;
                options.error = function(resp) {
                    if (error) error(model, resp, options);
                    model.trigger('error', model, resp, options);
                };
            };

            // Cleans the membership triple if the generator is for a container.
            var cleanGenerator = function(collection) {
                var generator = collection.generator;
                if(typeof(generator) !== 'string') {
                    var bgp = _.map(['subject','predicate','object'], function(p) {
                        var val = generator[p];
                        generator[p] = RDFStorage.namespaces.safeResolve(val);
                    });
                }
            };

            var generatorToQuery = function(generator) {
                if(typeof(generator) === 'string') {
                    return generator;
                } else {

                    var query = "", collection = this;;
                    var bgp = _.map(['subject','predicate','object'], function(p) {
                        var val = generator[p];
                        if(val === "<>") {
                            return "<"+collection.uri+">";
                        } else if(val === RDFStorage.namespaces.safeResolve('ldp:MemberSubject')) {
                            return "?"+collection.idVariable;
                        } else {
                            return "<"+val+">";
                        }
                    }).join(" ");

                    return "{ "+bgp+" }";
                }
            };

            var setupGraphModel = function(collection) {
                if(collection.isReadWrite) {
                    // LDP container
                    if(collection.isNew()) {
                        // Not backed by a remote LDP container yet.
                        // Let's setup the properties based in the constructor information.
                        var attributes = {'@id': collection.uri,
                                          'rdf:type': uriProp(RDFStorage.namespaces.safeResolve('lbb:Collection'))};
                        if(collection.generator.subject == null) {
                            attributes['ldp:membershipSubject'] = uriProp(collection.uri);
                            attributes['ldp:membershipPredicate'] = uriProp(RDFStorage.namespaces.safeResolve(collection.generator.predicate));
                            attributes['ldp:membershipObject'] = uriProp(RDFStorage.namespaces.safeResolve('ldp:MemberSubject'));

                            return new LinkedModel(attributes);
                        } else {
                            attributes['ldp:membershipSubject'] = uriProp(RDFStorage.namespaces.safeResolve(collection.generator.subject));
                            attributes['ldp:membershipPredicate'] = uriProp(RDFStorage.namespaces.safeResolve(collection.generator.predicate));
                            attributes['ldp:membershipObject'] = uriProp(RDFStorage.namespaces.safeResolve(collection.generator.object));

                            return new LinkedModel(attributes);
                        }
                    
                        return new LinkedModel(attributes);
                    } else {

                        // The container is already a remote resource.
                        // Let's set the URI and use the regular 'fetch' method to retrieve
                        // the RDF representation
                        var model = new LinkedModel({'@id':collection.uri})
                        //model.fetch();
                        return model;

                    }
                } else {
                    // Plain collection not a container.
                    var attributes = {'@id': collection.uri,
                                      'rdf:type': uriProp(RDFStorage.namespaces.safeResolve('lbb:DataView'))};
                    return new LinkedModel(attributes);
                }
            };

            // Backbone.Linked.LDPResource
            // ----------------------------

            // LDPResource is just a wrapper for synching a model or 
            // container collection to a remote LDP Server.

            // Map from CRUD to HTTP for our default `Backbone.Linked.LDPResource.sync` implementation.
            var methodMap = {
                'create': 'POST',
                'update': 'PUT',
                'patch':  'PATCH',
                'delete': 'DELETE',
                'read':   'GET'
            };

            var LDPResource = Backbone.Linked.LDPResource = {


                sync: function(method, model, options) {
                    var type = methodMap[method];

                    // Default options, unless specified.
                    _.defaults(options || (options = {}), {
                        emulateHTTP: Backbone.emulateHTTP,
                        emulateJSON: Backbone.emulateJSON
                    });

                    var params = { type: type };

                    // Ensure that we have a URL.
                    if (!options.url) {
                        params.url = _.result(model, 'url') || urlError();
                    }

                    // Ensure that we have the appropriate request data.
                    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {

                        // Default Turtle content type.
                        // It should be supported by a LDP server
                        // . @see LDP spec 5.4.5
                        params.contentType = 'text/turtle';
                        if(method === 'create') {
                            parseOptions = _.extend(options,{anonymous:true})
                        } else {
                            parseOptions = _.extend(options,{anonymous:false})
                        }
                        params.data = options.attrs || model.toNT(parseOptions);
                    }

                    // For older servers, emulate JSON by encoding the request into an HTML-form.
                    if (options.emulateJSON) {
                        params.contentType = 'application/x-www-form-urlencoded';
                        params.data = params.data ? {model: params.data} : {};
                    }

                    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
                    // And an `X-HTTP-Method-Override` header.
                    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
                        params.type = 'POST';
                        if (options.emulateJSON) params.data._method = type;
                        var beforeSend = options.beforeSend;
                        options.beforeSend = function(xhr) {
                            xhr.setRequestHeader('X-HTTP-Method-Override', type);
                            if (beforeSend) return beforeSend.apply(this, arguments);
                        };
                    }

                    // Don't process data on a non-GET request.
                    if (params.type !== 'GET' && !options.emulateJSON) {
                        params.processData = false;
                    }

                    // If we're sending a `PATCH` request, and we're in an old Internet Explorer
                    // that still has ActiveX enabled by default, override jQuery to use that
                    // for XHR instead. Remove this line when jQuery supports `PATCH` on IE8.
                    if (params.type === 'PATCH' && noXhrPatch) {
                        params.xhr = function() {
                            return new ActiveXObject("Microsoft.XMLHTTP");
                        };
                    }

                    // Make the request, allowing the user to override any Ajax options.
                    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
                    model.trigger('request', model, xhr, options);
                    return xhr;
                    
                }
            };

            // Private helper function for LDPResource
            var urlError = function() {
                throw new Error('A model with "uri" or "url" property or function must be specified');
            };


            // Finishing
            // ---------

            // Registering the LDP prefix
            RDFStorage.namespaces.register("ldp","http://www.w3.org/ns/ldp#");
            RDFStorage.namespaces.register("lbb","http://linked.backbone.org/vocab#");
            
            // Invoke the callback after initialization
            if(cb != null)
                cb(true); 
        });
    }; // end of Backbone.Linked.bootstrap

}).call(this);
