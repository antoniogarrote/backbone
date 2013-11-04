(function() {

    module("Backbone.Linked.RDFStorage", {
        setup: function() {
            stop();
            Backbone.Linked.bootstrap(function(){
                Backbone.Linked.registerNamespaces({ex: "http://example.com/"})
                start();
            });
        }
    });

    asyncTest("Should be able to start and stop observing a node", function(){
        expect(9);
        var counter = 0;
        var callback = function(node) {
            counter++;
            ok(node !== null, "Should be a node")
            if(counter === 1) {
                equal([].length,_.keys(node).length,"Should return empty object if the node is not there yet");
            } else if(counter === 2) {
                equal("book1", node["http://example.com/title"], "should have title");
                equal(122, node["http://example.com/num_pages"], "should have a number of pages");
                Backbone.Linked.RDFStorage.stopObservingNode("c1");
                counter = 9 // guard to make sure we're skipping this insertion
                Backbone.Linked.RDFStore.execute('INSERT DATA {  ex:book ex:author "Test Author" }')                
                setTimeout(function() { 
                    Backbone.Linked.RDFStorage.startObservingNode("c1","ex:book",callback);                    
                },1000);
            } else if(counter === 10) {
                equal("book1", node["http://example.com/title"], "should have title");
                equal(122, node["http://example.com/num_pages"], "should have a number of pages");
                equal("Test Author", node["http://example.com/author"], "should have an author");
                start();
            } else {
                expect(false, "Callback invoked a wrong number of times");
            }
        }

        Backbone.Linked.RDFStorage.startObservingNode("c1","ex:book",callback);

        Backbone.Linked.RDFStore.execute('INSERT DATA {  ex:book ex:title "book1"; ex:num_pages 122 }')
    });

    asyncTest("Should be able to start and stop observing a query", function(){
        var counter = 0;
        var callback = function(tuples) {
            counter++;
            ok(tuples !== null, "Should be some results")
            if(counter === 1) {
                expect(0, tuples.length);
            } else if(counter === 2) {
                expect(3, tuples.length);
                var res = _.map(tuples, function(tuple){ return tuple['p'] });
                deepEqual([10,15,20],res);
            } if(counter === 3) {
                expect(4, tuples.length);
                var res = _.map(tuples, function(tuple){ return tuple['p'] });
                deepEqual([10,15,20,25],res);
                
                Backbone.Linked.RDFStorage.stopObservingQuery("q1");
                Backbone.Linked.RDFStore.execute('INSERT DATA {  ex:book5 ex:num_pages 30 }')                
                setTimeout(function() { 
                    counter = 9 // guard to make sure we're skipping this insertion
                    Backbone.Linked.RDFStorage.startObservingQuery("q1","{ ?s ex:num_pages ?p }",{order: "?s"}, callback);                    
                },1000);
            } else if(counter === 4) {
                assert(false);
                start();
            } else if(counter === 10) {
                expect(5, tuples.length);
                var res = _.map(tuples, function(tuple){ return tuple['p'] });
                deepEqual([10,15,20,25,30],res);

                start();
            }
        };

        Backbone.Linked.RDFStorage.startObservingQuery("q1","{ ?s ex:num_pages ?p }",{order: "?s"}, callback);

        Backbone.Linked.RDFStore.execute('INSERT DATA {  ex:book1 ex:num_pages 10 . ex:book2 ex:num_pages 15 . ex:book3 ex:num_pages 20 }')

        Backbone.Linked.RDFStore.execute('INSERT DATA {  ex:book4 ex:num_pages 25 }')

    });
})();
