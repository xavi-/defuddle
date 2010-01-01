var sys = require('sys');
var http = require('http');

var srv = (function() {
    var urls = {},
        patterns = [],
        error = function(req, res) { 
            var body = "404'd";
            res.sendHeader(404, [ ["Content-Type", "text/plain"],
                                  ["Content-Length", body.length] ]);
            res.sendBody(body);
            res.finish();
        };

    function findPattern(req) {
        for(var i = 0, l = patterns.length; i < l; i++) {
            if(patterns[i].test(req)) {
                return patterns[i].handler;
            }
        }
        
        return null;
    }    
        
    http.createServer(function(req, res) {
        (urls[req.uri.path] || findPattern(req) || error)(req, res);
    }).listen(8000);
    
    return { urls: urls, patterns: patterns, error: error };
})();

// /channel/<session-id>/send?msg=<json> => returns an info-id
// /channel/<session-id>/read?info-id=<int-id> => returns a list of json messages
var chn = (function() {
    var sessions = {}, requests = {};
    
    var nextInfoId = (function() {
        var infoId = 1;
        return function nextInfoId() { return infoId++; };
    })();
    
    (function() { // Send
        var regSend = new RegExp("/channel/([0-9]+)/send");
        srv.patterns.push({
            test: function(req) { return regSend.test(req.uri.path); },
            handler: function(req, res) {
                var sessionId = regSend.exec(req.uri.path)[1];
                var msg = JSON.parse(req.uri.params["msg"]);
                var infoId = nextInfoId();
                var body = infoId.toString();
                
                sessions[sessionId] = (sessions[sessionId] || []).concat({ infoId: infoId, message: msg });
                
                res.sendHeader(200, { "Content-Length": body.length,
                                      "Content-Type": "text/plain" });
                res.sendBody(body);
                res.finish();
            }
        });
    })();
    
    (function() { // Read
        var regRead = new RegExp("/channel/([0-9]+)/read");
        srv.patterns.push({
            test: function(req) { return regRead.test(req.uri.path); },
            handler: function(req, res) { 
                var sessionId = regRead.exec(req.uri.path)[1];
                var session = sessions[sessionId] || [];
                var infoId = parseInt(req.uri.params["info-id"], 10) || 0;
                var body = JSON.stringify(session.filter(function(item) { return item.infoId >= infoId; }));
                
                res.sendHeader(200, { "Content-Length": body.length,
                                      "Content-Type": "application/json" });
                res.sendBody(body);
                res.finish();
            }
        });
    })();
})();

sys.puts("It's time to pictionary");