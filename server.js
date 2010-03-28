var sys = require("sys");
var http = require("http");
var url = require("url");
var fs = require("fs");

var srv = (function() {
    var urls = {},
        patterns = [],
        error = function(req, res) { 
            var body = "404'd";
            res.sendHeader(404, { "Content-Length": body.length,
                                  "Content-Type": "text/plain" });
            res.write(body);
            res.close();
            
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
        fs.readFile(path, function(err, data) {
            if(err) { throw err; };
            
            res.sendHeader(200, { "Conent-Length": data.length,
                                  "Content-Type": mime });
            res.write(data, "utf8");
            res.close();
        });
    }

    return function(path, mime) {
        return function(req, res) { Handler(path, mime, req, res); }; 
    };
})();

srv.urls["/"] = srv.urls["/index.html"] = StaticFileHandler("./index.html", "text/html");

srv.urls["/client.js"] = StaticFileHandler("./client.js", "application/x-javascript");

srv.urls["/pictionary.html"] = StaticFileHandler("./pictionary.html", "text/html");

srv.urls["/block-game.html"] = StaticFileHandler("./block-game.html", "text/html");

srv.urls["/tic-tac-toe.html"] = StaticFileHandler("./tic-tac-toe.html", "text/html");

srv.urls["/kung-fu-chess.html"] = StaticFileHandler("./kung-fu-chess.html", "text/html");

srv.urls["/hexlib/src/hex.js"] = StaticFileHandler("./hexlib/src/hex.js", "application/x-javascript");

srv.urls["/game-lib/tic-tac-toe.js"] = StaticFileHandler("./game-lib/tic-tac-toe.js", "application/x-javascript");

srv.urls["/game-lib/block.js"] = StaticFileHandler("./game-lib/block.js", "application/x-javascript");

srv.urls["/game-lib/kung-fu-chess.js"] = StaticFileHandler("./game-lib/kung-fu-chess.js", "application/x-javascript");

(function() { // Servers pics directory.  Currently assumes all images are pngs
    var regPic = new RegExp("/pics/([a-zA-Z0-9_-]+).png");
    srv.patterns.push({
        test: function(req) { return regPic.test(url.parse(req.url).pathname); },
        handler: function(req, res) {
            var uri = url.parse(req.url, true);
            var picName = regPic.exec(uri.pathname)[1];
            
            fs.readFile("./pics/" + picName + ".png", "binary", function(err, data) {
                if(err) { throw err; }
                
                res.sendHeader(200, { "Content-Length": data.length,
                                      "Content-Type": "image/png" });
                res.write(data, "binary");
                res.close();
            });
        }
    });
})();

// /channel/<session-id>/send?msg=<json> => returns an info-id
// /channel/<session-id>/read?info-id=<int-id> => returns a list of json messages
var chn = (function() {
    var _onCreate = [];

    var Channel = (function() {
        var nextInfoId = (function() {
            var infoId = 1;
            return function nextInfoId() { return infoId++; };
        })();
        
        function sendJSON(userId, content, res) {
            var body = JSON.stringify(content);                    
            res.sendHeader(200, { "Content-Length": body.length,
                                  "Content-Type": "application/json",
                                  "Cache-Control": "no-cache",
                                  "Set-Cookie": userId  + "; path=/;"});
            res.write(body);
            res.close();
        }
        
        return function Channel(id) {
            var users = {}, responses = [], _onReceive = [];
            
            this.id = id;
            
            this.data = [];
            
            this.users = function() { return users; };
            
            this.onReceive = function onReceive(callback) { _onReceive.push(callback); };
            
            this.info = function info(userId, type, res) {
                var content = { type: type };
                
                if(type === "users") { content.message = users; }
                else if(type === "remove-me") {
                    content.message = (users[userId] ? "OK" : "NA");
                    responses = responses.filter(function(o) { return o.userId !== userId; });
                    users[userId] = 0;
                }
                else { content.message = "Unknown Type"; }
                
                sendJSON(userId, content, res);
            };
            
            this.send = function send(userId, content) {                
                var info = [], lastInfoId;
                function sendMore(userId, content) {
                    lastInfoId = nextInfoId();
                    info.push({ infoId: lastInfoId, message: { userId: userId, content: content } });
                    return lastInfoId;
                }
                
                sendMore(userId, content);
                
                for(var i = 0; i < _onReceive.length; i++) { _onReceive[i].call(this, info[0].message, sendMore); }
                if(!info[0].message.content) { return -1; }
                
                Array.prototype.push.apply(this.data, info);
                
                responses.filter(function(o) { return o.userId !== userId; })
                         .forEach(function(o) { sendJSON(o.userId, info, o.response); });
                responses = responses.filter(function(o) { return o.userId === userId; });
                
                var newInfo = info.filter(function(o) { return o.message.userId !== userId; });
                if(newInfo.length > 0) {
                    responses.forEach(function(o) { sendJSON(o.userId, newInfo, o.response); });
                    responses = [];
                }
                    
                return lastInfoId;
            };
            
            this.read = function read(userId, infoId, res) {
                var content = this.data.filter(function(item) { return item.infoId > infoId; });
                
                if(content.length === 0) {
                    responses = responses.filter(function(o) { return o.userId !== userId; });
                    responses.push({ userId: userId, response: res, time: (new Date()).getTime() });
                } else { sendJSON(userId, content, res); }
            };
            
            setInterval(function() {
                var curTime = (new Date()).getTime();
                responses // Removing old responses
                    .filter(function(o) { return curTime - o.time > 45000; })
                    .forEach(function(o) { sendJSON(o.userId, [], o.response);  o.response = null; });
                responses = responses.filter(function(o) { return o.response != null });
                
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
                res.write(infoId);
                res.close();
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

chn.onCreate(function(id, channel) { sys.puts("New Channel called: " + id);
    if(id === "pictionary") { createPictionary(channel); }
    else if(id === "tic-tac-toe") { createTicTacToeGame(channel); }
    else if(id === "block") { createBlockGame(channel); }
    else if(id === "kung-fu-chess") { createKungFuChessGame(channel); }
});

function createKungFuChessGame(channel) {
    var kfc = require("./game-lib/kung-fu-chess");
    var players, game = new kfc.Game();
    var LAG_TIME = 1000;
    
    function onBoard(pos) {
        return 0 <= pos.row && pos.row < 8 && 0 <= pos.col && pos.col < 8;
    }
    
    channel.onReceive(function(msg, sendMoreInfo) {
        if("clear" in msg.content) {
            channel.data = channel.data.splice(-1);
            
            var users = channel.users();
            var canidates = Object.keys(users);
            if(canidates.length < 2) { return; }
            
            game.reset();
            
            players = {};
            players[canidates[0]] = "white";
            players[canidates[1]] = "black";
            
            sendMoreInfo("0", { "new-game": players  });
            sys.puts("New Kung-Fu Chess Game: " + sys.inspect(players));
            
            return;
        }
        
        if("move" in msg.content) {
            if(!players[msg.userId]) {
                sys.puts("Cheater! bad player : " + msg.userId);
                sys.puts("players: " + sys.inspect(players));
                msg.content = null; return;
            }
            
            var from = msg.content["move"].from, to = msg.content["move"].to;
            var piece = game.board[from.row][from.col];
            if(!onBoard(from) || !onBoard(to)) {
                sys.puts("Cheater! bad 'to' or 'from' location : " + msg.userId);
                sys.puts("to: " + sys.inspect(to) + "; from: " + sys.inspect(from));
                msg.content = null; return;
            }
            
            if(players[msg.userId] !== piece.color) {
                sys.puts("Cheater! piece wrong color : " + msg.userId);
                sys.puts("piece color: " + piece.color + "; user color: " + players[msg.userId]);
                msg.content = null; return;
            }
            
            if(Date.now() - piece.lastMoved < (5000 - LAG_TIME)) {
                sys.puts("Cheater! moved piece too quickly : " + msg.userId);
                sys.puts("piece lastMoved: " + piece.lastMoved + "; time now: " + (new Date()));
                msg.content = null; return;
            }
            
            if(!piece.isValidMove(to.row, to.col)) {
                sys.puts("Cheater! invalid for piece : " + msg.userId);
                sys.puts("piece: type: " + piece.type + "; from: " + sys.inspect(from) + "; to: " + sys.inspect(to));
                msg.content = null; return;
            }
            
            piece.pos(to.row, to.col);
            
            if(game.isOver) { sendMoreInfo("0", { "game-over": { "loser": game.isOver } }); }
        }
    });
}

function createBlockGame(channel) {
    var blk = require("./game-lib/block");
    var players, game = { a: new blk.Game(true), b: new blk.Game(true) };
    var piecesPlaced = 0;
    
    function createPieces() {
        var pieces = [];
        
        for(var i = 0; i < 5; i++) {
            pieces.push([ Math.floor(Math.random() * blk.Game.colors.length),
                          Math.floor(Math.random() * blk.Game.colors.length),
                          Math.floor(Math.random() * blk.Game.colors.length) ]);
        }
        
        return pieces;
    }
    
    channel.onReceive(function(msg, sendMoreInfo) {
        if("clear" in msg.content) {
            channel.data = channel.data.splice(-1);
            
            var users = channel.users();
            var canidates = Object.keys(users);
            if(canidates.length < 2) { return; }
            
            game.a.reset();
            game.b.reset();
            
            players = { a: canidates[0], b: canidates[1] };
            sendMoreInfo("0", { "new-game": players, "init-pieces": createPieces() });
            sys.puts("New Block Game: a: " + players.a + "; b: " + players.b);
            
            return;
        }
        
        if("piece-placed" in msg.content) {
            piecesPlaced += 1;
            sys.puts("piece placed");
            if(piecesPlaced % 4 === 0) { sendMoreInfo("0", { "new-pieces": createPieces() }); sys.puts("sent more pieces"); }
            
            return;
        }
    });
}

function createTicTacToeGame(channel) {
    var ttt = require("./game-lib/tic-tac-toe");
    var players, game = new ttt.Game();
    
    channel.onReceive(function(msg, sendMoreInfo) {
        if("clear" in msg.content) {        
            channel.data = channel.data.splice(-1)
            
            var users = channel.users();
            var canidates = Object.keys(users);
            if(canidates.length < 2) { return; }
            
            game.reset();
            
            players = { x: canidates[0], o: canidates[1] };
            
            sendMoreInfo("0", { "new-game": players });
            sys.puts("New TicTacToe Game: x: " + players.x + "; o: " + players.o);
        } else if(players) {
            if(msg.userId != players.x && msg.userId != players.o) {
                sys.puts("Cheater! bad player : " + msg.userId);
                sys.puts("players: " + sys.inspect(players));
                msg.content = null; return; 
            }
            
            if(game.whosTurn !== msg.content.turn) {
                sys.puts("Cheater! wrong turn : game: " + game.whosTurn + "; msg: " + msg.content.turn);
                msg.content = null; return; 
            }
            
            var row = msg.content.row, col = msg.content.col;
            if(!game.board[row][col].isEmpty()) { 
                sys.puts("Cheater! bad cell : row: " + row + "; col: " + col); 
                msg.content = null; return; 
            } else { game.board[row][col].symbol(msg.content.turn); }
            
            var winner = game.isGameOver();
            if(winner) { sendMoreInfo("0", { "game-over": winner }); }
        }
    });
}

function createPictionary(channel) {
    channel.onReceive(function(msg) {
        if("clear" in msg.content) { channel.data = channel.data.splice(-1); } 
    });
}

sys.puts("It's time to fud");