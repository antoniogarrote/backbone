(function() {

    module("Examples from Developing Backbone Applications book", {
        setup: function() {
            stop();
            Backbone.Linked.bootstrap(function(){
                Backbone.Linked.registerNamespaces({book: "http://addyosmani.github.io/backbone-fundamentals/"})
                start();
            });
        }
    });

    //
    // MODELS
    //

    test("Model initialization", function() {
        var Todo = Backbone.Linked.Model.extend({});

        // We can then create our own concrete instance of a (Todo) model
        // with no values at all:
        var todo1 = new Todo();

        ///////////////////////////
        // Linked Data extensions
        ///////////////////////////
        // A self-generated URI will be assigned to the new model instance
        // if no URI is provided

        equal(JSON.stringify(todo1),'{"@id":"http://linked.backbone.org/models/anon#1"}');

        // or with some arbitrary data:
        var todo2 = new Todo({
            title: 'Check the attributes of both model instances in the console.',
            completed: true,
            '@id': 'http://somewhere.intheinterwebs.com/me'
        });


        ///////////////////////////
        // Linked Data extensions
        ///////////////////////////
        // If a URI is provided using the '@id' property, it will be used to identify the model instance.

        equal(JSON.stringify(todo2),'{"title":"Check the attributes of both model instances in the console.","completed":true,"@id":"http://somewhere.intheinterwebs.com/me"}');
    });

    test("Model initializers", function() {
        var now = new Date();
        var Todo = Backbone.Linked.Model.extend({
            initialize: function(){
                this.builtAt = now;
            }
        });

        var myTodo = new Todo();

        equal(myTodo.builtAt, now);
    });

    test("Default values", function() {
        var Todo = Backbone.Linked.Model.extend({
            // Default todo attribute values
            defaults: {
                title: '',
                completed: false
            }
        });

        // Now we can create our concrete instance of the model
        // with default values as follows:
        var todo1 = new Todo();

        equal(todo1.get('title'),'');
        equal(todo1.get('completed'),false);

        // Or we could instantiate it with some of the attributes (e.g., with custom title):
        var todo2 = new Todo({
            title: 'Check attributes of the logged models in the console.'
        });

        equal(todo2.get('title'),'Check attributes of the logged models in the console.');
        equal(todo2.get('completed'),false);


        // Or override all of the default attributes:
        var todo3 = new Todo({
            title: 'This todo is done, so take no action on this one.',
            completed: true
        });

        equal(todo3.get('title'),'This todo is done, so take no action on this one.');
        equal(todo3.get('completed'),true);
    });

    
    test("Getters", function() {

        ///////////////////////////
        // Linked Data extensions
        ///////////////////////////
        // Properties for Linked.Models are URIs. they can be
        // specified as CURIEs or full URIS.
        // If just a plain string is passed for the property,
        // it will transformed into a URI using the default namespace.

        var Todo = Backbone.Linked.Model.extend({
            // Default todo attribute values
            defaults: {
                'foaf:title': '',
                completed: false
            }
        });
        
        var todo1 = new Todo();
        equal(todo1.get('foaf:title'),''); // empty string
        equal(todo1.get('completed'),false); // false

        var todo2 = new Todo({
            'http://xmlns.com/foaf/0.1/title': "Retrieved with model's get() method.",
            completed: true
        });

        ///////////////////////////
        // Linked Data extensions
        ///////////////////////////
        // Properties can be retrived and set using CURIEs. The library
        // will perform the resolution of that CURIE into a full URI.
        // Properties are always stored into the Model instance attributes
        // map using full URIs

        equal(todo2.get('foaf:title'),'Retrieved with model\'s get() method.'); // Retrieved with model's get() method.
        equal(todo2.get('http://xmlns.com/foaf/0.1/title'),'Retrieved with model\'s get() method.'); // Retrieved with model's get() method.
        equal(todo2.get('completed'),true); // true
    });

    test("Setters", function() {
        var Todo = Backbone.Linked.Model.extend({
            // Default todo attribute values
            defaults: {
                title: '',
                completed: false
            }
        });

        // Setting the value of attributes via instantiation
        var myTodo = new Todo({
            title: "Set through instantiation."
        });

        equal(myTodo.get('title'),'Set through instantiation.');
        equal(myTodo.get('completed'),false);


        // Set single attribute value at a time through Model.set():
        myTodo.set("title", "Title attribute set through Model.set().");
        equal(myTodo.get('title'),'Title attribute set through Model.set().');

        // Set map of attributes through Model.set():
        myTodo.set({
            title: "Both attributes set through Model.set().",
            completed: true
        });

        equal(myTodo.get('title'),'Both attributes set through Model.set().');
        equal(myTodo.get('completed'),true);
    });


    test("Direct access", function() {
        var changes = [];

        var Person = new Backbone.Linked.Model();
        Person.on("change:name", function() { changes.push('name changed') });
        Person.set({name: 'Andrew'});
        
        // new change
        deepEqual(changes, ['name changed']);

        Person.set({name: 'Jeremy'}, {silent: true});

        // no change
        deepEqual(changes, ['name changed']);


        ok(Person.hasChanged("name"));
        // true: change was recorded

        ok(Person.hasChanged(null));
        // true: something (anything) has changed
    });

    test("Listeners in constructor", function() {
        var changes = [];

        var Todo = Backbone.Linked.Model.extend({
            // Default todo attribute values
            defaults: {
                title: '',
                completed: false
            },
            initialize: function(){
                changes.push("INITIALIZED");
                this.on('change', function(){
                    changes.push("CHANGE");
                });
            }
        });

        var myTodo = new Todo();

        myTodo.set('title', 'The listener is triggered whenever an attribute value changes.');
        changes.push("SET TITLE");


        myTodo.set('completed', true);
        changes.push("SET COMPLETED");
        console.log('Completed has changed: ' + myTodo.get('completed'));

        myTodo.set({
            title: 'Changing more than one attribute at the same time only triggers the listener once.',
            completed: true
        });
        changes.push("SET MULTIPLE");

        deepEqual(changes,
                  ["INITIALIZED", 
                   "CHANGE", 
                   "SET TITLE", 
                   "CHANGE", 
                   "SET COMPLETED", 
                   "CHANGE", 
                   "SET MULTIPLE"])

        // Above logs:
        // This model has been initialized.
        // - Values for this model have changed.
        // Title has changed: The listener is triggered whenever an attribute value changes.
        // - Values for this model have changed.
        // Completed has changed: true
        // - Values for this model have changed.
    });

    test("Individual properties listeners", function() {
        var changes = [];

        var Todo = Backbone.Linked.Model.extend({
            // Default todo attribute values
            defaults: {
                'foaf:title': '',
                completed: false
            },

            initialize: function(){
                changes.push('INITIALIZED');

                ///////////////////////////
                // Linked Data extensions
                ///////////////////////////
                // In order to listen for changes in RDF properties
                // the event name 'change' plus the curie or
                // the full URI of the property can be used
                this.on('change:foaf:title', function(){
                    changes.push('TITLE_CHANGE');
                });
            },

            setTitle: function(newTitle){
                this.set({ 'foaf:title': newTitle });
            }
        });

        var myTodo = new Todo();

        // Both of the following changes trigger the listener:
        myTodo.set('foaf:title', 'Check what\'s logged.');
        myTodo.setTitle('Go fishing on Sunday.');

        // But, this change type is not observed, so no listener is triggered:
        myTodo.set('completed', true);
        equal(myTodo.get('completed'), true);

        // Above logs:
        // This model has been initialized.
        // Title value for this model has changed.
        // Title value for this model has changed.
        deepEqual(changes,['INITIALIZED','TITLE_CHANGE','TITLE_CHANGE']);
    });

    test("Validations", function() {
        var Person = new Backbone.Linked.Model({'foaf:name': 'Jeremy'});

        // Validate the model name
        Person.validate = function(attrs) {
            ///////////////////////////
            // Linked Data extensions
            ///////////////////////////
            // All Linked.Model objects have a rdfGet
            // function that allow them to look for properties
            // in objects using CURIEs that will be expanded 
            // into full URIs.
            if (!Person.rdfGet(attrs, 'foaf:name')) {
                return 'I need your name';
            }
        };

        // Change the name
        Person.set({'foaf:name': 'Samuel'});
        equal(Person.get('foaf:name'),'Samuel');
        // 'Samuel'

        // Remove the name attribute, force validation

        success = Person.unset('foaf:name', {validate: true});

        ok(!success);
        equal(Person.get('foaf:name'),'Samuel');
        equal(Person.validationError,"I need your name");
    });

    test("Validation events", function() {
        var errors = [];

        var Todo = Backbone.Linked.Model.extend({
            defaults: {
                completed: false
            },

            validate: function(attributes){
                if(attributes.title === undefined){
                    return "Remember to set a title for your todo.";
                }
            },

            initialize: function(){
                console.log('This model has been initialized.');
                this.on("invalid", function(model, error){
                    errors.push(error);
                });
            }
        });

        var myTodo = new Todo();
        myTodo.set('completed', true, {validate: true}); // logs: Remember to set a title for your todo.
        equal(myTodo.get('completed'),false);
        deepEqual(errors, ['Remember to set a title for your todo.']);
    });

    //
    // COLLECTIONS
    //

    asyncTest("Basic", function() {
        Backbone.Linked.setLogLevel('debug');
        var Todo = Backbone.Linked.Model.extend({
            defaults: {
                title: '',
                completed: false
            }
        });

        var TodosCollection = Backbone.Linked.Collection.extend({
            model: Todo
        });

        var myTodo0 = new Todo({title:'Read the whole book', '@id': '0'});

        var todos = new TodosCollection([myTodo0]);
        var myTodo1 = new Todo({title:'Read the whole book', '@id': '1'});


        todos.add(myTodo1);


        Backbone.Linked.RDFStore.execute("SELECT ?s ?o { ?s rdfs:member ?o }", function(s, results) {
            console.log(_.map(results, function(tuple) {
                return JSON.stringify([tuple.s.value, tuple.o.value]); 
            }));
        });

        deepEqual(todos.get('rdfs:member',{resolve: false}),["@id:0","@id:1"]);
        var models = _.map(todos.get('rdfs:member'),function(model){ return model.uri; });
        deepEqual(models,["0","1"]);
        equal(todos.length,2);

        var myTodo2 = new Todo({title:'Read the whole book2', '@id': '2'});

        todos.add(myTodo2);

        deepEqual(todos.get('rdfs:member',{resolve: false}),["@id:0","@id:1","@id:2"]);
        equal(todos.length,3);

        todos.remove(myTodo1);

        deepEqual(todos.get('rdfs:member',{resolve: false}),["@id:0","@id:2"]);
        equal(todos.length,2);

        todos.add([{ '@id' : '0', title: "Other title 0" }], {merge: true });
        todos.add([{ '@id' : '2', title: "Other title 2" }]); // merge: false
        
        deepEqual(todos.get('rdfs:member',{resolve: false}),["@id:0","@id:2"]);
        equal(todos.length,2);
        equal(todos.get('0').get('title'),"Other title 0");
        equal(todos.get('2').get('title'),'Read the whole book2');

        todos.reset([
            { '@id':'3', title: 'Read the whole book3' }
        ]);


        deepEqual(todos.get('rdfs:member',{resolve: false}),["@id:3"]);
        equal(todos.length,1);
        equal(todos.at(0).get('title'),"Read the whole book3");

        Backbone.Linked.RDFStore.execute("SELECT ?id { ?s rdfs:member ?id }", function(success,tuples) {
            equal(tuples.length, 1);
            equal(tuples[0].id.value, '3');
            start();
        });
    });

    asyncTest("Collections", function() {
        var Todo = Backbone.Linked.Model.extend({
            defaults: {
                title: '',
                completed: false
            }
        });

        var TodosCollection = Backbone.Linked.Collection.extend({
            model: Todo
        });

        var myTodo = new Todo({title:'Read the whole book', id: 2});

        // pass array of models on collection instantiation
        var todos = new TodosCollection([myTodo]);
        
        console.log("Collection size: " + todos.length); // Collection size: 1
        equal(todos.length,1);
        equal(todos.at(0).get("title"),"Read the whole book");

        ///////////////////////////
        // Linked Data extensions
        ///////////////////////////


        // LinkedModels are RDF graphs. They are identified by an URI.
        // If no URI is provided, a default unique URI will be generated.
        equal(todos.at(0).uri != null, true);


        // All LinkedCollections create membership triples for every model
        // added to the collection. 
        // If no specified, the rdfs:member property will be used by default.
        // We can look for matches in the RDF store of the application.
        // LinkedCollections are also LinkedResources, so Model methods
        // can be used on them and they are also identified by a URI.

        Backbone.Linked.RDFStore.execute(
            "SELECT ?member { <"+todos.uri+"> rdfs:member ?member }", 
            function(success, results) {
                equal(results.length, 1);
                equal(results[0].member.value, todos.at(0).uri);
                equal(todos.get('rdfs:member').length, 1);
                start();
        });
    });



    test("Adding and Removing Models", function() {
        Backbone.Linked.setLogLevel('debug');
        var Todo = Backbone.Linked.Model.extend({
            defaults: {
                title: '',
                completed: false
            }
        });

        var TodosCollection = Backbone.Linked.Collection.extend({
            model: Todo,
        });

        var a = new Todo({ title: 'Go to Jamaica.'}),
        b = new Todo({ title: 'Go to China.'}),
        c = new Todo({ title: 'Go to Disneyland.'});

        var todos = new TodosCollection([a,b]);
        console.log("Collection size: " + todos.length);
        // Logs: Collection size: 2
        equal(todos.length, 2);

        todos.add(c);
        console.log("Collection size: " + todos.length);
        // Logs: Collection size: 3
        equal(todos.length, 3);

        todos.remove([a,b]);
        console.log("Collection size: " + todos.length);
        // Logs: Collection size: 1
        equal(todos.length, 1);

        todos.remove(c);
        console.log("Collection size: " + todos.length);
        // Logs: Collection size: 0        
        equal(todos.length, 0);

        ///////////////////////////
        // Linked Data extensions
        ///////////////////////////

        // Adding and removing models to collections only change
        // the membership triples from the graph.
        // If no members are there, the property will return undefined.
        // The models array will still be available but empty.

        equal(todos.get("rdfs:member") == undefined, true);
        equal(todos.models.length, 0);
    });


    test("Merging models when adding them to collections", function() {
        var items = new Backbone.Linked.Collection;
        items.add([{ '@id' : '1', name: "Dog" , age: 3}, { '@id' : '2', name: "cat" , age: 2}]);
        items.add([{ '@id' : '1', name: "Bear" }], {merge: true });
        items.add([{ '@id' : '2', name: "lion" }]); // merge: false

        var m1 = new Backbone.Linked.Model({'@id': '1'});
        var m2 = new Backbone.Linked.Model({'@id': '2'});

        // [{"id":1,"name":"Bear","age":3},{"id":2,"name":"cat","age":2}]
        equal(m1.get('name'),"Bear")
        equal(m1.get('age'),3);
        equal(m2.get('name'),'cat');
        equal(m2.get('age'),2);
    });

    test("Retrieving models #get", function() {
        var Todo = Backbone.Linked.Model.extend({
            defaults: {
                title: '',
                completed: false
            }
        });

        var TodosCollection = Backbone.Linked.Collection.extend({
            model: Todo,
        });

        var myTodo = new Todo({title:'Read the whole book', '@id': '2'});

        // pass array of models on collection instantiation
        var todos = new TodosCollection([myTodo]);

        ///////////////////////////
        // Linked Data extensions
        ///////////////////////////

        // get can be used to find by URI in the contained models.
        // Since URIs can only be strings, no numbers or other objects
        // can be used as the @id value of a LinkedModel.
        var todo2 = todos.get('2');

        // Models, as objects, are passed by reference
        equal(todo2,myTodo); // true        

        // extends the previous example

        var todoCid = todos.get(todo2.cid);

        // As mentioned in previous example, 
        // models are passed by reference
        console.log(todoCid === myTodo); // true
    });

    test("Listening for events", function() {
        var TodosCollection = new Backbone.Linked.Collection();

        var messages = [];

        TodosCollection.on("add", function(todo) {
            messages.push("I should " + todo.get("title") + ". Have I done it before? "  + (todo.get("completed") ? 'Yeah!': 'No.' ));
        });

        TodosCollection.add([
            { title: 'go to Jamaica', completed: false },
            { title: 'go to China', completed: false },
            { title: 'go to Disneyland', completed: true }
        ]);

        // The above logs:
        // I should go to Jamaica. Have I done it before? No.
        // I should go to China. Have I done it before? No.
        // I should go to Disneyland. Have I done it before? Yeah!        

        equal(messages[0],"I should go to Jamaica. Have I done it before? No.")
        equal(messages[1],"I should go to China. Have I done it before? No.")
        equal(messages[2],"I should go to Disneyland. Have I done it before? Yeah!")
    });

    test("Change events", function() {
        var TodosCollection = new Backbone.Linked.Collection();

        var messages = [];

        // log a message if a model in the collection changes
        TodosCollection.on("change:titled", function(model) {
            messages.push("Changed my mind! I should " + model.get('titled'));
        });

        ///////////////////////////
        // Linked Data extensions
        ///////////////////////////

        // CURIEs can be used as properties and also to listen
        // to change values on those properties.
        TodosCollection.on("change:foaf:title", function(model) {
            messages.push("[URI] Changed my mind! I should " + model.get('foaf:title'));
        });

        TodosCollection.add([
            { titled: 'go to Jamaica.', completed: false, '@id': '3', 'foaf:title': 'test todo' },
        ]);

        var myTodo = TodosCollection.get('3');

        myTodo.set('titled', 'go fishing');
        // Logs: Changed my mind! I should go fishing
        equal(messages[0],"Changed my mind! I should go fishing");

        myTodo.set('foaf:title', 'test todo with id 3');
        equal(messages[1],"[URI] Changed my mind! I should test todo with id 3");

    });

    test("Refreshing a collection", function() {

        //Backbone.Linked.setLogLevel('debug');

        var TodosCollection = new Backbone.Linked.Collection();

        TodosCollection.add([
            { '@id': '1', title: 'go to Jamaica.', completed: false },
            { '@id': '2', title: 'go to China.', completed: false },
            { '@id': '3', title: 'go to Disneyland.', completed: true }
        ]);

        var log = {
            completed: null,
            added: null,
            removed: null,
            counter: 0
        }

        // we can listen for add/change/remove events
        TodosCollection.on("add", function(model) {
            log.counter++;
            log.added = "Added " + model.get('title');
        });

        TodosCollection.on("remove", function(model) {
            log.counter++;
            log.removed = "Removed " + model.get('title');
        });

        TodosCollection.on("change:completed", function(model) {
            log.counter++
            log.completed = "Completed " + model.get('title');
        });


        TodosCollection.set([
            { '@id': '1', title: 'go to Jamaica.', completed: true },
            { '@id': '2', title: 'go to China.', completed: false },
            { '@id': '4', title: 'go to Disney World.', completed: false }
        ]);

        // Above logs:
        // Removed go to Disneyland.
        // Completed go to Jamaica.
        // Added go to Disney World.
        equal(log.counter,3);
        equal(log.added, "Added go to Disney World.");
        equal(log.removed, "Removed go to Disneyland.");
        equal(log.completed, "Completed go to Jamaica.");
    });

    test("Collection reset", function() {
        var TodosCollection = new Backbone.Linked.Collection();

        // we can listen for reset events
        TodosCollection.on("reset", function() {
            console.log("Collection reset.");
        });

        TodosCollection.add([
            { title: 'go to Jamaica.', completed: false },
            { title: 'go to China.', completed: false },
            { title: 'go to Disneyland.', completed: true }
        ]);

        console.log('Collection size: ' + TodosCollection.length); // Collection size: 3
        equal(TodosCollection.length, 3);

        TodosCollection.reset([
            { title: 'go to Cuba.', completed: false }
        ]);
        // Above logs 'Collection reset.'

        console.log('Collection size: ' + TodosCollection.length); // Collection size: 1
        equal(TodosCollection.length, 1);
    });


    test("Reset events", function() {
        var Todo = new Backbone.Linked.Model();
        var Todos = new Backbone.Linked.Collection([Todo])
            .on('reset', function(Todos, options) {
                equal(options.previousModels.length, 1);
                equal(options.previousModels[0],Todo); // true
            })
            .on('add', function() {
                ok(false,"add events should not be fired when resetting the collection");
            })
            .on('remove', function() {
                ok(false,"remove events should not be fired whe resetting the collection");
            });

        Todos.reset([]);        
    });


    test("Intelligent set in collections", function() {
        // Define a model of type 'Beatle' with a 'job' attribute
        var Beatle = Backbone.Linked.Model.extend({
            defaults: {
                job: 'musician'
            }
        });

        // Create models for each member of the Beatles
        var John = new Beatle({ firstName: 'John', lastName: 'Lennon'});
        var Paul = new Beatle({ firstName: 'Paul', lastName: 'McCartney'});
        var George = new Beatle({ firstName: 'George', lastName: 'Harrison'});
        var Ringo = new Beatle({ firstName: 'Ringo', lastName: 'Starr'});

        var changes = {
            added: [],
            removed: []
        };

        // Create a collection using our models
        var theBeatles = new Backbone.Linked.Collection([John, Paul, George, Ringo])
            .on('add', function(beatle) {
                changes.added.push(beatle.get('firstName'));
            })
            .on('remove', function(beatle) {
                changes.removed.push(beatle.get('firstName'));
            });

        // Create a separate model for Pete Best
        var Pete = new Beatle({ firstName: 'Pete', lastName: 'Best'});

        // Update the collection
        Paul.set('age', 71);
        theBeatles.set([John, Paul, George, Pete]);

        deepEqual(theBeatles.map(function(beatle) { return beatle.get('firstName') }).sort(), ["George", "John", "Paul", "Pete"]);
        deepEqual(theBeatles.map(function(beatle) { return beatle.get('lastName') }).sort(), ["Best", "Harrison", "Lennon", "McCartney"]);
        deepEqual(Ringo.collection, undefined);
        deepEqual(theBeatles.find(function(beatle){ return beatle.get('firstName') === 'Paul' }).get('age'), 71);

        deepEqual(changes.added, ['Pete']);
        deepEqual(changes.removed, ['Ringo']);
    });

})();
