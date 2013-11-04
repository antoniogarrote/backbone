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

    test("Should be able to craete a new Model object with new RDF data.", function() {
        var users = this.Users.where("{ ?id a ex:User }");
        equal(users.length,2);
    });

})();
