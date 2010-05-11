var sys = require("sys");
var url = require("url");
var fs = require("fs");
var bind = require("./libraries/bind-js");

var srv = require("./libraries/xavlib/simple-router");

var BindFileHandler = (function() {
    function Handler(path, context, req, res) {
        fs.readFile(path, function(err, data) {
            if(err) { throw err; };
            
            bind.to(data, context, function(data) {
                res.sendHeader(200, { "Conent-Length": data.length,
                                      "Content-Type": "text/html" });
                res.end(data, "utf8");
            });
        });
    }

    return function(path, context) {
        return function(req, res) { Handler(path, context, req, res); }; 
    };
})();

function bindLink(val, context) {
    val = JSON.parse(val);
    
    if(context.page === val.name) { return val.name; }
    else { return ["<a href='", val.url, "'>", val.name, "</a>"].join(""); }
}

srv.urls["/"] = 
srv.urls["/index.html"] = 
srv.urls["/pictionary.html"] = BindFileHandler("./games/pictionary/index.html", { page: "pictionary", link: bindLink });

srv.urls["/block.js"] = srv.staticFileHandler("./games/block/index.js", "application/x-javascript");
srv.urls["/block-game.html"] = BindFileHandler("./games/block/index.html",
                                               { page: "block game", link: bindLink });

srv.urls["/tic-tac-toe.js"] = srv.staticFileHandler("./games/tic-tac-toe/index.js", "application/x-javascript");
srv.urls["/tic-tac-toe.html"] = BindFileHandler("./games/tic-tac-toe/index.html", 
                                                { page: "tic-tac-toe", link: bindLink });

srv.urls["/kung-fu-chess.js"] = srv.staticFileHandler("./games/kung-fu-chess/index.js", "application/x-javascript");
srv.urls["/kung-fu-chess.html"] = BindFileHandler("./games/kung-fu-chess/index.html", 
                                                  { page: "kung-fu chess", link: bindLink });

srv.urls["/client.js"] = srv.staticFileHandler("./libraries/xavlib/channel/client.js", "application/x-javascript");
srv.urls["/json2.js"] = srv.staticFileHandler("./libraries/json2.js", "application/x-javascript");
srv.urls["/excanvas.js"] = srv.staticFileHandler("./libraries/excanvas.js", "application/x-javascript");
srv.urls["/libraries/hex.js"] = srv.staticFileHandler("./libraries/hexlib/src/hex.js", "application/x-javascript");

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
                res.end(data, "binary");
            });
        }
    });
})();

// /channel/<session-id>/send?msg=<json> => returns an info-id
// /channel/<session-id>/read?info-id=<int-id> => returns a list of json messages
var chn = require("./libraries/xavlib/channel");

chn.onCreate(function(id, channel) { sys.puts("New Channel called: " + id);
    if(id === "pictionary") { createPictionary(channel); }
    else if(id === "tic-tac-toe") { createTicTacToeGame(channel); }
    else if(id === "block") { createBlockGame(channel); }
    else if(id === "kung-fu-chess") { createKungFuChessGame(channel); }
});

function createKungFuChessGame(channel) {
    var kfc = require("./games/kung-fu-chess");
    var players = {}, game = new kfc.Game();
    var LAG_TIME = 1000;
    
    function onBoard(pos) {
        return 0 <= pos.row && pos.row < 8 && 0 <= pos.col && pos.col < 8;
    }
    
    channel.onReceive(function(msg, sendMoreInfo) {
        if("clear" in msg.content) {
            channel.data = [];
            
            var users = channel.users();
            if(users.length < 2) { return; }
            
            game.reset();
            
            if(!players.white || !players.black) { return; }
            
            sendMoreInfo("0", { "new-game": players  });
            sys.puts("New Kung-Fu Chess Game: " + sys.inspect(players));
            
            return;
        }
        
        if("sit" in msg.content) {
            delete players[players[msg.content["sit"]]];
            players[msg.content["sit"]] = msg.userId;
            players[msg.userId] = msg.content["sit"];
            
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
    var blk = require("./games/block");
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
            channel.data = [];
            
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
    var ttt = require("./games/tic-tac-toe");
    var players, game = new ttt.Game();
    
    channel.onReceive(function(msg, sendMoreInfo) {
        if("clear" in msg.content) {        
            channel.data = [];
            
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
        if("clear" in msg.content) { channel.data = []; } 
    });
}

srv.server.listen(8000);
chn.start(srv);
sys.puts("It's time to fud");