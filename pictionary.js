var sys = require("sys");
var http = require("http");
var url = require("url");
var process = require("posix");

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
        (urls[url.parse(req.url).pathname] || findPattern(req) || error)(req, res);
    }).listen(8000);
    
    return { urls: urls, patterns: patterns, error: error };
})();

srv.urls["/"] = srv.urls["/index.html"] = function(req, res) {
    var promise = process.cat("./index.html", "utf8");
    
    promise.addCallback(function(data) {
        res.sendHeader(200, { "Conent-Length": data.length,
                              "Content-Type": "text/html" });
        res.sendBody(data, "utf8");
        res.finish();
    });
};

srv.urls["/client.js"] = function(req, res) {
    var promise = process.cat("./client.js", "utf8");
    
    promise.addCallback(function(data) {
        res.sendHeader(200, { "Conent-Length": data.length,
                              "Content-Type": "application/javascript" });
        res.sendBody(data, "utf8");
        res.finish();
    });
};

// /channel/<session-id>/send?msg=<json> => returns an info-id
// /channel/<session-id>/read?info-id=<int-id> => returns a list of json messages
var chn = (function() {
    var sessions = {}, responses = {};
    
    var nextInfoId = (function() {
        var infoId = 1;
        return function nextInfoId() { return infoId++; };
    })();
    
    var nextUserId = (function() {
        var userId = (new Date()).getTime();
        return function nextUserId() { return (userId++).toString(); };
    })();
    
    (function() { // Send
        var regSend = new RegExp("/channel/([0-9]+)/send");
        srv.patterns.push({
            test: function(req) { return regSend.test(url.parse(req.url).pathname); },
            handler: function(req, res) {
                var uri = url.parse(req.url, true);
                var sessionId = regSend.exec(uri.pathname)[1];
                var msg = JSON.parse(uri.query["msg"]);
                var userId = req.headers["cookie"] || nextUserId();
                var infoId = nextInfoId();
                
                var body = infoId.toString();
                res.sendHeader(200, { "Content-Length": body.length,
                                      "Content-Type": "text/plain",
                                      "Set-Cookie": userId });
                res.sendBody(infoId.toString());
                res.finish();
                
                // reply new info to listeners
                var info = { infoId: infoId, message: { userId: userId, content: msg } };
                sessions[sessionId] = sessions[sessionId] || [];
                sessions[sessionId].push(info);
                
                var resBody = JSON.stringify(info);
                responses[sessionId] = responses[sessionId] || [];
                responses[sessionId]
                    .filter(function(o) { return o.userId != userId; })
                    .forEach(function(o) { 
                        o.response.sendHeader(200, { "Content-Length": resBody.length,
                                                     "Content-Type": "application/json",
                                                     "Set-Cookie": o.userId });
                        o.response.sendBody(resBody);
                        o.response.finish();
                    });
                responses[sessionId] = responses[sessionId].filter(function(o) { return o.userId == userId; });
            }
        });
    })();
    
    (function() { // Read
        var regRead = new RegExp("/channel/([0-9]+)/read");
        srv.patterns.push({
            test: function(req) { return regRead.test(url.parse(req.url).pathname); },
            handler: function(req, res) { 
                var uri = url.parse(req.url, true);
                var sessionId = regRead.exec(uri.pathname)[1];
                var session = sessions[sessionId] || [];
                var userId = req.headers["cookie"] || nextUserId();
                var infoId = parseInt(uri.query["info-id"], 10) || 0;
                var content = session.filter(function(item) { return item.infoId > infoId; });
                
                sys.puts(req.headers["cookie"]);
                
                if(content.length === 0) {
                    responses[sessionId] = responses[sessionId] || [];
                    responses[sessionId].push({ userId: userId, response: res });
                } else {
                    var body = JSON.stringify(content);
                    
                    res.sendHeader(200, { "Content-Length": body.length,
                                          "Content-Type": "application/json",
                                          "Set-Cookie": userId });
                    res.sendBody(body);
                    res.finish();
                }
            }
        });
    })();
})();

sys.puts("It's time to pictionary");