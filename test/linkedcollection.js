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
            changes.added.push(user.get('foaf:name'));
        });

        users.on('remove', function(user) {
            changes.removed.push(user.get('foaf:name'));
        });

        users.on('change',function(user) {
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
})();
