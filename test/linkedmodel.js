(function() {

    module("Backbone.Linked.Model", {
        setup: function() {
            stop();
            var that = this;
            Backbone.Linked.bootstrap(function(){
                Backbone.Linked.registerNamespaces({ex: "http://example.com/"})
                Backbone.Linked.RDFStore.execute("INSERT DATA { ex:ana foaf:name 'Ana Maria' ; foaf:account 'ana.maria@service.com' }");

                that.User = Backbone.Linked.Model.extend({
                    initialize: function() {
                        this.createdAt = new Date();
                    },

                    sayHi: function() {
                        return "Hi, I'm "+this.get('foaf:name');
                    }
                });

                start();
            });
        }
    });

    asyncTest("Should update automatically objects when new properties for the object URI are added", function(){
        var henry = new this.User({"@id": "http://bblfish.net/people/henry/card#me"});

        equal(henry.get('foaf:name'),undefined);

        Backbone.Linked.RDFStore.execute("INSERT DATA { <http://bblfish.net/people/henry/card#me> foaf:name 'Henry J. Story' }");

        equal(henry.get('foaf:name'),"Henry J. Story");
        start();
    });

    test("Should provide a compact JSON representation of a model", function() {
        var cate = new this.User({"foaf:name":"Caterina",
                                  "foaf:account":"cate.cova@service.com"});
        var compact = cate.toCompactJSON();
        equal(compact['foaf:name'], 'Caterina');
        equal(compact['foaf:account'], 'cate.cova@service.com');
        ok(compact['@id'] != null);
    });

    asyncTest("Should be able to craete a new Model object with new RDF data.", function() {
        expect(5);
        var cate = new this.User({"foaf:name":"Caterina",
                                  "foaf:account":"cate.cova@service.com"});
        
        var name = cate.get("foaf:name");
        equal(name, "Caterina");
        var account = cate.get("foaf:account");
        equal(account, "cate.cova@service.com");

        Backbone.Linked.RDFStore.execute("SELECT ?uri { ?uri foaf:name 'Caterina' }", function(success, res) {
            equal(res.length, 1);
            equal(res[0].uri.value, cate.uri);

            Backbone.Linked.RDFStorage.unlinkNode(cate.uri);

            setTimeout(function(){
                equal(cate.get("foaf:name"),null);
                start();
            },1000);
        });
    });

    asyncTest("Should be able to create a new Model object from existing RDF data and update a property.", function(){
        var ana = new this.User("ex:ana");

        var name = ana.get('foaf:name')
        equal(name, "Ana Maria");
        equal(ana.sayHi(), "Hi, I'm "+ana.get('foaf:name'));
        
        ana.on('change:foaf:name', function(node, newValue, options) {
            equal(newValue,"Anita");
            equal(ana.uri, node.uri);
            
            Backbone.Linked.RDFStore.execute("SELECT ?name { ex:ana foaf:name ?name }", function(success, res) {
                equal(res[0]['name'].value, "Anita");
                start();
            });
        });

        ana.set('foaf:name', 'Anita');
    });


})();
