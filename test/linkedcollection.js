(function() {

    module("Backbone.Linked.Collection", {
        setup: function() {
            stop();
            var that = this;
            Backbone.Linked.bootstrap(function(){
                Backbone.Linked.registerNamespaces({ex: "http://example.com/"})
                Backbone.Linked.RDFStore.execute("INSERT DATA { ex:ana foaf:name 'Ana Maria' ; a ex:User . ex:caterina foaf:name 'Caterina' ; a ex:User }");

                that.User = Backbone.Linked.Model.extend({

                    generator: "{ ?id a ex:User }",

                    initialize: function() {
                        this.createdAt = new Date();
                    },

                    sayHi: function() {
                        return "Hi, I'm "+this.get('foaf:name');
                    }
                });

                that.UsersCollection = Backbone.Linked.Collection.extend({
                    generator: "{ ?id a ex:User }",
                    model:     that.User
                });

                start();
            });
        }
    });

    test("Should be able to create a collection from the RDF graph data.", function() {
        var users = new this.UsersCollection();
        equal(users.length,2);
    });

    test("Should be able to change the size of the collection and sync changes in the state of their members.", function() {
        var users = new this.UsersCollection();
        equal(users.length,2);

        var that = this;
        Backbone.Linked.RDFStore.execute("INSERT DATA { ex:helena foaf:name 'Helena'; a ex:User }", function(){
            equal(users.length,3);            

            equal(users.at(1).get('foaf:name'),'Caterina');

            var cate = new that.User("ex:caterina")
            cate.set('foaf:name','Cate');

            equal(users.length,3);            
            equal(users.at(1).get('foaf:name'),'Cate');
        });
    });

    test("Should fire the right events when models are added, removed or have their properties changed.", function() {

        var users = new this.UsersCollection();
        var changes = {
            added: [],
            removed: [],
            changed: [],
        }

        users.on('add', function(user) {
            //console.log("** ADDED "+user.uri);
            changes.added.push(user.get('foaf:name'));
        });

        users.on('remove', function(user) {
            //console.log("** REMOVED "+user.uri);
            changes.removed.push(user.get('foaf:name'));
        });

        users.on('change',function(user) {
            //console.log("** CHANGED "+user.uri);
            changes.changed.push(user.get('foaf:name'));
        });

        Backbone.Linked.RDFStore.execute("INSERT DATA { ex:helena foaf:name 'Helena'; a ex:User }");
        Backbone.Linked.RDFStore.execute("DELETE DATA { ex:caterina a ex:User }");

        // This should not trigger a change since we have removed it
        // from the collection.
        var cate = new this.User('ex:caterina');
        cate.set('foaf:name',"Cate");

        var ana = new this.User('ex:ana');
        ana.set('foaf:name',"Ana");

        deepEqual(changes.added,['Helena']);
        deepEqual(changes.removed,['Caterina']);
        deepEqual(changes.changed,['Ana']);
    });

    test("Should be able to populate a read-write collection", function() {
        // This todo should already be in the store (and the collection). It's also a Note.
        Backbone.Linked.RDFStore.execute("INSERT DATA { ex:todo0 a ex:Todo, ex:Note ; ex:title 'ground zero note' }")

        var TodosCollection = Backbone.Linked.Collection.extend({
            generator: {subject: 'ldp:MemberSubject', predicate: 'rdf:type', object:'ex:Todo'}
        });

        var todos = new TodosCollection([
            {'ex:title': 'todo1',
             'ex:text': 'the first todo'}
        ]);

        equal(todos.length, 2);

        var zero = todos.at(0);
        equal(zero.get('rdf:type').length,2)
        equal(zero.get('ex:title'),'ground zero note');

        todos.add([
            {'ex:title': 'todo2',
             'ex:text': 'This is the second todo'},
            {'ex:title': 'todo3',
             'ex:text': 'This is the third todo'}
        ]);

        equal(todos.length, 4);

        Backbone.Linked.RDFStore.execute("SELECT ?id { ?id a ex:Todo }",function(success, res) {
            equal(res.length,4);
        });
    });

    test("It should be able to remove nodes from a collection", function() {
        Backbone.Linked.RDFStore.execute("INSERT DATA { ex:todo0 a ex:Todo, ex:Note ; ex:title 'ground zero note' }")

        var TodosCollection = Backbone.Linked.Collection.extend({
            generator: {subject: 'ldp:MemberSubject', predicate: 'rdf:type', object:'ex:Todo'}
        });

        var todos = new TodosCollection([
            {'ex:title': 'todo1',
             'ex:text': 'the first todo'}
        ]);

        equal(todos.length, 2);

        todos.remove("ex:todo0");

        equal(todos.length, 1);        
    });

})();
