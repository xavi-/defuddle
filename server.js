var sys = require("sys");
var http = require("http");
var url = require("url");
var process = require("posix");

var srv = (function() {
    var urls = {},
        patterns = [],
        error = function(req, res) { 
            var body = "404'd";
            res.sendHeader(404, { "Content-Length": body.length,
                                  "Content-Type": "text/plain" });
            res.sendBody(body);
            res.finish();
            
            sys.puts("Someone 404'd: " + req.url);
        };

    function findPattern(req) {
        for(var i = 0, l = patterns.length; i < l; i++) {
            if(patterns[i].test(req)) { return patterns[i].handler; }
        }
        
        return null;
    }    
        
    http.createServer(function(req, res) {
        (urls[url.parse(req.url).pathname] || findPattern(req) || error)(req, res);
    }).listen(8000);
    
    return { urls: urls, patterns: patterns, error: error };
})();

var StaticFileHandler = (function() {
    function Handler(path, mime, req, res) {
        var promise = process.cat(path, "utf8");
        
        promise.addCallback(function(data) {
            res.sendHeader(200, { "Conent-Length": data.length,
                                  "Content-Type": mime });
            res.sendBody(data, "utf8");
            res.finish();
        });
    }

    return function(path, mime) {
        return function(req, res) { Handler(path, mime, req, res); }; 
    };
})();

srv.urls["/"] = srv.urls["/index.html"] = StaticFileHandler("./index.html", "text/html");

srv.urls["/client.js"] = StaticFileHandler("./client.js", "application/javascript");

srv.urls["/pictionary.html"] = StaticFileHandler("./pictionary.html", "text/html");

srv.urls["/block-game.html"] = StaticFileHandler("./block-game.html", "text/html");

srv.urls["/tic-tac-toe.html"] = StaticFileHandler("./tic-tac-toe.html", "text/html");

// /channel/<session-id>/send?msg=<json> => returns an info-id
// /channel/<session-id>/read?info-id=<int-id> => returns a list of json messages
var chn = (function() {
    var _onCreate = [];

    var Channel = (function() {
        var nextInfoId = (function() {
            var infoId = 1;
            return function nextInfoId() { return infoId++; };
        })();
        
        return function Channel(id) {
            var users = {}, responses = [], _onReceive = [];
            
            this.id = id;
            
            this.data = [];
            
            this.users = function() { return users; };
            
            this.onReceive = function onReceive(callback) { _onReceive.push(callback); };
            
            this.clear = function clear() { this.data = []; };
            
            this.info = function info(userId, type, res) {
                var content = { type: type };
                
                if(type == "users") { content.message = users; }
                else if(type == "remove-me") {
                    content.message = (users[userId] ? "OK" : "NA");
                    responses = responses.filter(function(o) { return o.userId != userId; });
                    users[userId] = 0;
                }
                else { content.message = "Unknown Type"; }
                
                var body = JSON.stringify(content);                    
                res.sendHeader(200, { "Content-Length": body.length,
                                      "Content-Type": "application/json",
                                      "Cache-Control": "no-cache",
                                      "Set-Cookie": userId  + "; path=/;"});
                res.sendBody(body);
                res.finish();
            };
            
            this.send = function send(userId, content) {
                var infoId = nextInfoId();
                var info = { infoId: infoId, message: { userId: userId, content: content } };
                
                for(var i = 0; i < _onReceive.length; i++) { _onReceive[i].call(this, info.message); }
                if(!info.message.content) { return infoId; }
                
                this.data.push(info);
                
                var resBody = JSON.stringify([ info ]);
                responses
                    .filter(function(o) { return o.userId != userId; })
                    .forEach(function(o) { 
                        o.response.sendHeader(200, { "Content-Length": resBody.length,
                                                     "Content-Type": "application/json",
                                                     "Cache-Control": "no-cache",
                                                     "Set-Cookie": o.userId  + "; path=/;"});
                        o.response.sendBody(resBody);
                        o.response.finish();
                    });
                responses = responses.filter(function(o) { return o.userId == userId; });
                
                return infoId;
            };
            
            this.read = function read(userId, infoId, res) {
                var content = this.data.filter(function(item) { return item.infoId > infoId; });
                
                if(content.length === 0) {
                    responses.push({ userId: userId, response: res });
                } else {
                    var body = JSON.stringify(content);
                    
                    res.sendHeader(200, { "Content-Length": body.length,
                                          "Content-Type": "application/json",
                                          "Cache-Control": "no-cache",
                                          "Set-Cookie": userId + "; path=/;" });
                    res.sendBody(body);
                    res.finish();
                }
            };
            
            setInterval(function() {
                for(var userId in users) { users[userId] -= 1; }
                responses.forEach(function(o) { users[o.userId] = 2; });
                for(var userId in users) if(users[userId] <= 0) { delete users[userId]; }
            }, 5000);
            
            for(var i = 0; i < _onCreate.length; i++) { _onCreate[i].call(this, id, this); }
        };
    })();
    
    var channels = {};
    
    var nextUserId = (function() {
        var userId = (new Date()).getTime();
        return function nextUserId() { return (userId++).toString(); };
    })();
    
    (function() { // Info
        var regSend = new RegExp("/channel/([a-zA-Z0-9_-]+)/info");
        srv.patterns.push({
            test: function(req) { return regSend.test(url.parse(req.url).pathname); },
            handler: function(req, res) {
                var uri = url.parse(req.url, true);
                var channelId = regSend.exec(uri.pathname)[1];
                
                channels[channelId] = channels[channelId] || (new Channel(channelId));
                
                var userId = req.headers["cookie"] || nextUserId();
                var type = uri.query["type"];
                channels[channelId].info(userId, type, res);
            }
        });
    })();
    
    (function() { // Send
        var regSend = new RegExp("/channel/([a-zA-Z0-9_-]+)/send");
        srv.patterns.push({
            test: function(req) { return regSend.test(url.parse(req.url).pathname); },
            handler: function(req, res) {
                var uri = url.parse(req.url, true);
                var channelId = regSend.exec(uri.pathname)[1];
                
                channels[channelId] = channels[channelId] || (new Channel(channelId));
                
                var userId = req.headers["cookie"] || nextUserId();
                var content = JSON.parse(uri.query["msg"]);
                var infoId = channels[channelId].send(userId, content).toString();
                
                // reply new info to listeners
                res.sendHeader(200, { "Content-Length": infoId.length,
                                      "Content-Type": "text/plain",
                                      "Cache-Control": "no-cache",
                                      "Set-Cookie": userId + "; path=/;"});
                res.sendBody(infoId);
                res.finish();
            }
        });
    })();
    
    (function() { // Read
        var regRead = new RegExp("/channel/([a-zA-Z0-9_-]+)/read");
        srv.patterns.push({
            test: function(req) { return regRead.test(url.parse(req.url).pathname); },
            handler: function(req, res) { 
                var uri = url.parse(req.url, true);
                var channelId = regRead.exec(uri.pathname)[1];
                
                channels[channelId] = channels[channelId] || (new Channel(channelId));
                
                var userId = req.headers["cookie"] || nextUserId();
                var infoId = parseInt(uri.query["info-id"], 10) || 0;
                channels[channelId].read(userId, infoId, res);
                
                sys.puts(req.headers["cookie"]);
            }
        });
    })();
    
    return { channels: channels, onCreate: function(callback) { _onCreate.push(callback); } };
})();

chn.onCreate(function(id, channel) {
    if(id === "pictionary") { 
        channel.onReceive(function(msg) { if("clear" in msg.content) { channel.clear(); } });
    } else if(id === "tic-tac-toe") { createTicTacToeGame(channel); }
});

function createTicTacToeGame(channel) {
    var curGame = null;
    
    channel.onReceive(function(msg) {
        if("clear" in msg.content) {        
            channel.clear();
            
            var users = channel.users();
            var players = Object.keys(users);
            if(players.length < 2) { return; }
            
            curGame = { x: players[0], o: players[1] };
            channel.send("0", { "new-game": curGame });
            sys.puts("New TicTacToe Game: x: " + curGame.x + "; o: " + curGame.o);
        } else if(curGame) {
            if(msg.userId != curGame.x && msg.userId != curGame.o) { msg.content = null; }
        }
    });
}

sys.puts("It's time to fud");