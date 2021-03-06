(function(context) {
    var event = (function() {
        function create(ctx) {
            var listeners = [], addObj = { add: add };
            
            function add(listener) { listeners.push(listener); return addObj; };
            
            add.trigger = function trigger(e) {
                for(var i = 0; i < listeners.length; i++) { listeners[i].apply(ctx, arguments); }
            };
            
            return add;
        }
        
        return { create: create };
    })();

    function Cell(board, row, col) {
        var symbol = null;
        
        this.board = board;
        
        this.row = row;
        
        this.col = col;
        
        this.isEmpty = function() { return !symbol; };
        
        this.symbol = function() {
            if(arguments.length === 0) { return symbol; }
            
            symbol = arguments[0];
            this.onChange.trigger({ symbol: symbol, source: arguments[1] });
        };
        
        this.onChange = event.create(this);
        
        Cell.onCreate.trigger(this);
    }
    Cell.onCreate = event.create();
    
    function Board() {
        Board.onCreate.trigger(this);
        
        for(var r = 0; r < 3; r++) {
            this[r] = [];
            
            for(var c = 0; c < 3; c++) { this[r][c] = new Cell(this, r, c); }
        }
    }
    Board.onCreate = event.create();
    
    var Game = (function() {    
        function updateTurns(e) {
            this.whosTurn = this.whosNext;
            this.whosNext = (this.whosTurn === "X") ? "O" : "X";
        }
    
        function Game() {
            this.board = new Board();
            
            this.whosTurn = "";
            
            this.whosNext = "X";
                        
            this.onReset = event.create(this);
                        
            this.onPlacement = event.create(this);
            
            Game.onCreate.trigger(this);
            
            for(var r = 0; r < 3; r++) {
                for(var c = 0; c < 3; c++) {
                    this.board[r][c].onChange((function(game) { 
                        return function(e) {
                            if(e.source === "reset") { return; }
                            game.onPlacement.trigger({cell: this, source: e.source });
                            updateTurns.call(game);
                        };
                    })(this));
                }
            }   
        }
        Game.onCreate = event.create();
        
        Game.prototype.reset = function() {
            this.whosTurn = "";
            this.whosNext = "X";
            
            for(var i = 0; i < 3; i++) {
                for(var j = 0; j < 3; j++) { this.board[i][j].symbol(null, "reset"); }
            }
            
            updateTurns.call(this);
            this.onReset.trigger();
        };
        
        Game.prototype.isGameOver = function() {
            var tests = [ [ this.board[0][0].symbol(), this.board[0][1].symbol(), this.board[0][2].symbol() ],
                          [ this.board[1][0].symbol(), this.board[1][1].symbol(), this.board[1][2].symbol() ],
                          [ this.board[2][0].symbol(), this.board[2][1].symbol(), this.board[2][2].symbol() ],
                          [ this.board[0][0].symbol(), this.board[1][0].symbol(), this.board[2][0].symbol() ],
                          [ this.board[0][1].symbol(), this.board[1][1].symbol(), this.board[2][1].symbol() ],
                          [ this.board[0][2].symbol(), this.board[1][2].symbol(), this.board[2][2].symbol() ],
                          [ this.board[0][0].symbol(), this.board[1][1].symbol(), this.board[2][2].symbol() ],
                          [ this.board[0][2].symbol(), this.board[1][1].symbol(), this.board[2][0].symbol() ] ];
            
            var hasEmptyCell = false, winner = null;
            for(var t = 0; t < tests.length; t++) {
                var test = tests[t];
                hasEmptyCell = hasEmptyCell || !test[0] || !test[1] || !test[2];
                
                if(test[0] && test[0] == test[1] && test[1] == test[2]) { winner = test[0]; break; }
            }
            
            return winner || (!hasEmptyCell && "cat");
        };
        
        return Game;
    })();
    
    context.Cell = Cell;
    context.Board = Board;
    context.Game = Game;
})(typeof exports === "object" ? exports : (window.ttt = {}));