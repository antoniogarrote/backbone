# Linked Data extensions for Backbone

This library is a set of extensions for Backbone that make it easier to write JS MVC applications using RDF as the data model and the [Linked Data Platform](http://www.w3.org/TR/ldp/) as the backend data service.
It is still work in progress.

## Requirements

No automation for bundling all the required sources is still in place. In order to use the library the following dependencies must be manually included.
They all can be found in the root directory of the project.

- RDFStore.js (rdf_store.js)
- Linked data extensions (linked.js)

## Design

The library uses a RDF storage library to merge into he client side RDF data retrieved from different LDP resources.
On top of the client side RDF graph resulting after merging all the data retrieved from the LDP resources, two main abstractions can be used to build the application logic:

- Linked.Model
- Linked.Collection

Both Model and Collection are counterparts of Backbone Models and Collections and they can interact with the upper layers of Backbone architecture (views, controllers, routers, etc.) without changes in the code. 
The main difference between Backbone standard data entities and the Backbone.Linked data entities is that Linked.Collections are also Linked.Models. This makes it possible to store Linked.Collections within Linked.Collections and to use the Backbone Model interface with Linked.Collections to retrieve properties stored in the RDF graph and associated to these collections.

Linked.Models are identified by an unique URI. If this URI matches a remote LDP resource, the model can be synched with the LDP resource using the standard Backbone interface for persistence (save, fetch, destroy...). These operations will be translated into the right HTTP requests by the Linked.LDPResource module.

Linked.Collections are also defined by an Unique URI and a collection gnerator. Generators can be of two kinds:
- Membership triples
- SPARQL queries.

They can also be associated to an existing LDP Container but this is not mandatory. 

If the collection is created using a membership triple, all models whose URIs in the client side RDF graph match the triple will be included in the collection.
Adding models to a membership triple backed collections will result in new membership triples being added to the client side RDF graph.

If the collection is backed by a LDP Container, collection persistence and object creation methods will be avaialable.

Linked Collections can also be created specifying a generic SPARQL query as the generator. These collections act as read only data views over the RDF graph, including all the data models matching the SPARQL query as members. Modifications of the properties of Linked.Model objects or the RDF graph will change automatically the members of the data view collection.

Finally, all components of the data layer are bound by RDF events, everytime a model or collection are modified using the backbone interface, new triples are added or removed from the client side graph. Modifications on the graph (using SPARQL update queries or adding RDF data retrieved from a LDP server) will result in events being triggered by the RDF Storage component triggering the right modifications in Linked.Model and Linked.Collections to reflect the new state of the RDF graph.


## Examples

Initialization:

```javascript
Backbone.Linked.bootstrap(function(){
  // Registering the default namespace.
  Backbone.Linked.registerNamespaces({ex: "http://test.com/vocab#"})

  // Aplication logic here.
});
```


Basic Linked.Model and Linked.Collection operations:

```javascript

// Definition of a Linked.Model.
var Todo = Backbone.Linked.Model.extend({
    defaults: {
        title: '',
        completed: false
    }
});

// Definition of a Linked.Collection.
// Default memebership triple will be rdfs:member if one is specified.
var TodosCollection = Backbone.Linked.Collection.extend({
    model: Todo
});

// Defining some Model objects
// '@id' is the default Identifier. It must be a valid URI.
var myTodo0 = new Todo({title:'Read the whole book', '@id': '0'});
var myTodo1 = new Todo({title:'Read the whole book', '@id': '1'});

// Creation of a new collections
var todos = new TodosCollection([myTodo0]);

// Adding to the collection
todos.add(myTodo1);

Backbone.Linked.RDFStore.execute("SELECT ?s ?o { ?s rdfs:member ?o }", function(s, results) {
  // Output:
  /*
     [['http://linked.backbone.org/models/anon#1","0"]", "["http://linked.backbone.org/models/anon#1","1"]"] 
  */
  console.log(_.map(results, function(tuple) {
    return JSON.stringify([tuple.s.value, tuple.o.value]);  
  }));
});

// RDF properties can be retrieved using the standard 'get' function.
// URIs as values of properties will be marked by the '@id:' prefix.
// Properties can e also retrieved from collections (including the membership predicate).
deepEqual(todos.get('rdfs:member'),["@id:0","@id:1"]);
equal(todos.length,2);

var myTodo2 = new Todo({title:'Read the whole book2', '@id': '2'});

todos.add(myTodo2);

deepEqual(todos.get('rdfs:member'),["@id:0","@id:1","@id:2"]);
equal(todos.length,3);

// Removing an object.
todos.remove(myTodo1);

deepEqual(todos.get('rdfs:member'),["@id:0","@id:2"]);
equal(todos.length,2);

// Use of standard Backbone options like 'merge'
todos.add([{ '@id' : '0', title: "Other title 0" }], {merge: true });
todos.add([{ '@id' : '2', title: "Other title 2" }]); // merge: false

deepEqual(todos.get('rdfs:member'),["@id:0","@id:2"]);
equal(todos.length,2);
equal(todos.get('0').get('title'),"Other title 0");
equal(todos.get('2').get('title'),'Read the whole book2');

// Collection reset.
todos.reset([
    { '@id':'3', title: 'Read the whole book3' }
]);


deepEqual(todos.get('rdfs:member'),["@id:3"]);
equal(todos.length,1);
equal(todos.at(0).get('title'),"Read the whole book3");

Backbone.Linked.RDFStore.execute("SELECT ?id { ?s rdfs:member ?id }", function(success,tuples) {
    equal(tuples.length, 1);
    equal(tuples[0].id.value, '3');
    start();
});
```

```javascript
// Creating a new collection from a LDP Container
var xdir = new Backbone.Linked.Collection({uri:'https://localhost:8443/2013/XDir/'});

// Fetching container state.
xdir.fetch({
    success: function(container){
        equal(container.uri,'https://localhost:8443/2013/XDir/');
        equal(container.get('foaf:maker'), '@id:https://localhost:8443/2013/card#me');
        
        // Creating a new LDP Resource inside the container.
        xdir.create({'foaf:name':'foo thing'},{
            success:function(model, resp, options) {

                //model.set('ex:other','bar');
                //model.save();
                model.destroy({
                    success: function(resp) {
                        console.log("YES!");
                    }
                });
                start();
            }
        });
    }
});
```

## Tests

There are a number of tests already included in the library source code. Just load 'test/index.html' inside a browser.
In order to test the LDP persistence test, a running instance of the LDP platform must be running. I'm using [RWW-Play](https://github.com/read-write-web/rww-play)
as my test backend service. The 'test' directory must be accessible from the running RWW-Play server and all access allowed 
to the resources for the tests to run.

## TODO

This is just a very preliminary work. Lots of things are still missing:

- ACLs and access policies.
- Complete support for LDP interaction.
- Testing nested collections.
- Complete testing of Backbone interface compatibility.
- Retrieving of associated models and collections to a model.
- Better definition of collection's generators.
- ...

