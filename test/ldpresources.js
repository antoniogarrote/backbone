(function() {

    module("Backbone.Linked.LDPResource", {
        setup: function() {
            stop();
            Backbone.Linked.bootstrap(function(){
                Backbone.Linked.registerNamespaces({ex: "http://example.com/"})
                start();
            });
        }
    });

    asyncTest("Should be able to fetch ane existing LDPResource", function() {
        var xdir = new Backbone.Linked.Collection({uri:'https://localhost:8443/2013/XDir/'});
        xdir.fetch({
            success: function(container){
                equal(container.uri,'https://localhost:8443/2013/XDir/');
                equal(container.get('foaf:maker'), '@id:https://localhost:8443/2013/card#me');
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
    });
})();
