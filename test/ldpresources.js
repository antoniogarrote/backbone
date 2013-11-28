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
/*
    asyncTest("Should be able to fetch ane existing LDPResource", function() {
        var xdir = new Backbone.Linked.Collection({uri:'https://localhost:8443/2013/XDir/'});
        xdir.fetch({
            success: function(container){
                equal(container.uri,'https://localhost:8443/2013/XDir/');
                // missing container data??
                //equal(container.get('foaf:maker').uri, 'https://localhost:8443/2013/card#me');
                xdir.create({'foaf:name':'foo thing'},{
                    success:function(model, resp, options) {
                        //model.set('ex:other','bar');
                        //model.save(null,{
                        //    success: function(container) {
                                model.destroy({
                                    success: function(resp) {
                                        ok(true);
                                        start();
                                    },
                                    error: function(resp) {
                                        ok(false);
                                        start();
                                    }
                                });
                        //    }
                        //});
                    }
                });
            }
        });
    });
*/


    asyncTest("Should be possible to create nested collections", function() {
        stop();
        var GenericContainer = Backbone.Linked.Collection.extend({
            generator: {
                subject: '<>',
                predicate: 'ldp:created',
                object: 'ldp:MemberSubject'
            }
        });

        var root = new GenericContainer({uri: 'https://localhost:8443/2013/'});
        root.fetch({
            success: function(container) {
                // missing container data??
                //equal(container.models.length, container.get('ldp:created').length);

                var nestedContainer = new GenericContainer();
                debugger;
                Backbone.Linked.setLogLevel('debug');
                container.create(nestedContainer,{
                    success: function(resp) {
                        debugger;
                        nestedContainer.toNT();
                        nestedContainer.add([
                            {'foaf:name': 'a'},
                            {'foaf:name': 'b'}
                        ]);
                        debugger;
                        nestedContainer.save(null, {
                            success: function(resp) {
                                console.log("YES??");
                                debugger;
                                start();
                            }
                        });

                    }
                })
               // container.create({'rdf:type': '@id:ldp:Container',
               //                   'ldp:Membershipsubject': '<>',
               //                   'ldp:MembershipPredicate': _.rdf.uri('rdfs:member'),
               //                   'ldp:MembershipObject': _.rdf.uri('ldp:MemberSubject')}, {
               //                       success: function(resp) {
               //                           console.log("YES");
               //                           start();
               //                       }
               //                   })
                                  
            }
        });
    });


})();
