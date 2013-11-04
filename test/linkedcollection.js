(function() {

    module("Backbone.Linked.Collection", {
        setup: function() {
            stop();
            var that = this;
            Backbone.Linked.bootstrap(function(){
                Backbone.Linked.registerNamespaces({ex: "http://example.com/"})
                Backbone.Linked.RDFStore.execute("INSERT DATA { ex:ana foaf:name 'Ana Maria' ; a ex:User . ex:caterina foaf:name 'Caterina' ; a ex:User }");

                that.User = Backbone.Linked.Model.extend({
                    initialize: function() {
                        this.createdAt = new Date();
                    },

                    sayHi: function() {
                        return "Hi, I'm "+this.get('foaf:name');
                    }
                });

                that.Users = Backbone.Linked.Collection.extend({
                    model: that.User
                });

                start();
            });
        }
    });

    test("Should be able to create a collection from the RDF graph data.", function() {
        var users = this.Users.where("{ ?id a ex:User }");
        equal(users.length,2);
    });

    test("Should be able to change the size of the collection.", function() {
        var users = this.Users.where("{ ?id a ex:User }");
        equal(users.length,2);

        var that = this;
        Backbone.Linked.RDFStore.execute("INSERT DATA { ex:helena foaf:name 'Helena'; a ex:User }", function(){
            equal(users.length,3);            
            var cate = new that.User("ex:caterina")
            cate.set('foaf:name','Cate');
            equal(users.length,3);            
            equal(users.at(1).get('foaf:name'),'Cate');
        });
    });

})();
