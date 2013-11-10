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
        debugger;
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

        debugger;
        var todos = new TodosCollection([a,b]);
        console.log("Collection size: " + todos.length);
        // Logs: Collection size: 2
        equal(todos.length, 2);
        debugger;

        todos.add(c);
        console.log("Collection size: " + todos.length);
        // Logs: Collection size: 3
        equal(todos.length, 3);
        debugger;

        todos.remove([a,b]);
        console.log("Collection size: " + todos.length);
        // Logs: Collection size: 1
        equal(todos.length, 1);
        debugger;

        todos.remove(c);
        console.log("Collection size: " + todos.length);
        // Logs: Collection size: 0        
        equal(todos.length, 0);
        debugger;
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
        debugger;
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

    
})();
