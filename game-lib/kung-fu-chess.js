(function(context) {
    function Event(ctx) {
        var listeners = [];
        
        this.add = function(listener) { listeners.push(listener); };
        
        this.trigger = function trigger(e) {
            for(var i = 0; i < listeners.length; i++) { listeners[i].call(ctx, e, ctx); }
        };
    }
    
    var Piece = (function() {
        function onBoard(pos) {
            return 0 <= pos.row && pos.row < 8 && 0 <= pos.col && pos.col < 8;
        }
        
        function canOccupyGen(board, piece) {
            return function(m) { return board[m.row][m.col].isEmpty || board[m.row][m.col].color !== piece.color; };
        }
        
        var pieces = {};
        pieces["pawn"] = function() {
            var pos = this.pos(), row = pos.row, col = pos.col;
            var dir = (this.color === "black" ? -1 : 1);
            var moves = [ { row: row + dir, col: col + 1 }, { row: row + dir, col: col - 1 } ];
            moves = moves.filter(onBoard)
                         .filter(canOccupyGen(this.board, this))
                         .filter(function(m) { return !m.isEmpty });
            if(this.board[row + dir][col].isEmpty) { 
                moves.push({ row: row + dir, col: col }); 
                
                if(!this.hasMoved && this.board[row + dir * 2][col].isEmpty) {
                    moves.push({ row: row + dir * 2, col: col }); 
                }
            }
            
            return moves;
        };
        
        pieces["knight"] = function() {
            var pos = this.pos(), row = pos.row, col = pos.col;
            var moves = [ { row: row - 2, col: col - 1 }, { row: row - 2, col: col + 1 }, 
                          { row: row + 2, col: col - 1 }, { row: row + 2, col: col + 1 },
                          { row: row - 1, col: col - 2 }, { row: row - 1, col: col + 2 },
                          { row: row + 1, col: col - 2 }, { row: row + 1, col: col + 2 } ];
            
            return moves.filter(onBoard).filter(canOccupyGen(this.board, this));
        };
        
        (function() { // Available moves code for Bishop and Rook pieces
            function getContiguousMoves(piece, canOccupy, moveGen) {
                var curPos = piece.pos(), moves = [];
                
                for(var i = 1; i <= 7; i++) {
                    var move = moveGen.call(curPos, i);
                    if(!onBoard(move)) { break; }
                    
                    if(canOccupy(move)) { moves.push(move); }
                    
                    if(!piece.board[move.row][move.col].isEmpty) { break; }
                }
                
                return moves;
            }
            
            function getMoves(piece, moveGens) {
                var canOccupy = canOccupyGen(piece.board, piece), moves = [];
                
                for(var i = 0; i < moveGens.length; i++) {
                    Array.prototype.push.apply(moves, getContiguousMoves(piece, canOccupy, moveGens[i]));
                }
                
                return moves;
            }
            
            pieces["bishop"] = (function() {
                var moveGens = [ function(i) { return { row: this.row + i, col: this.col + i }; }, 
                                 function(i) { return { row: this.row + i, col: this.col - i }; }, 
                                 function(i) { return { row: this.row - i, col: this.col + i }; },
                                 function(i) { return { row: this.row - i, col: this.col - i }; } ];
                
                return function() { return getMoves(this, moveGens); };
            })();
            
            pieces["rook"] = (function() {
                var moveGens = [ function(i) { return { row: this.row + i, col: this.col }; }, 
                                 function(i) { return { row: this.row - i, col: this.col }; }, 
                                 function(i) { return { row: this.row, col: this.col + i }; },
                                 function(i) { return { row: this.row, col: this.col - i }; } ];
                
                return function() { return getMoves(this, moveGens); };
            })();
        })();
        
        pieces["queen"] = function() {
            return pieces["bishop"].call(this).concat(pieces["rook"].call(this));
        };
        
        pieces["king"] = function() {
            var pos = this.pos(), row = pos.row, col = pos.col;
            var moves = [ { row: row + 1, col: col - 1 }, { row: row + 1, col: col }, { row: row + 1, col: col + 1 },
                          { row: row,     col: col - 1 },                             { row: row,     col: col + 1 },
                          { row: row - 1, col: col - 1 }, { row: row - 1, col: col }, { row: row - 1, col: col + 1 } ];
            
            return moves.filter(onBoard).filter(canOccupyGen(this.board, this));
        };
        
        function Piece(type, color, row, col, board) {
            this.board = board;
            
            this.type = type;
            
            this.color = color;
            
            this.hasMoved = false;
            
            this.lastMoved = 0;
         
            this.onMove = new Event(this);
            
            this.onDestroy = new Event(this);
            
            this.pos = function() {
                if(arguments.length === 0) { return { row: row, col: col }; }
                
                if(row == arguments[0] && col == arguments[1]) { return; }
                else { this.hasMoved = true; }
                
                board[row][col] = Board.emptyCell;
                
                var oldPos = { row: row, col: col };
                
                row = arguments[0];
                col = arguments[1];
                
                board[row][col].destroy();
                board[row][col] = this;
                
                this.onMove.trigger({ source: arguments[2], oldPos: oldPos, newPos: { row: row, col: col } });
                this.lastMoved = new Date();
            };
            
            this.availableMoves = pieces[type];
            
            this.destroy = function() {
                var pos = this.pos();   
                
                this.board[pos.row][pos.col] = Board.emptyCell;
                row = -1; col = -1;
                
                this.onDestroy.trigger();
            };
            
            Piece.onCreate.trigger(this);
            
            board[row][col] = this;
            this.onMove.trigger({ source: "creation", newPos: { row: row, col: col } });
        }
        Piece.onCreate = new Event();
        
        Piece.prototype.isEmpty = false;
        
        Piece.prototype.isValidMove = function(row, col) {
            var moves = this.availableMoves();
            for(var i = 0; i < moves.length; i++) {
                if(moves[i].row === row && moves[i].col === col) { return true; }
            }
            
            return false;
        };
        
        return Piece;
    })();
    
    function Board() {        
        for(var r = -1; r <= 8; r++) {
            this[r] = [];
            
            for(var c = -1; c <= 8; c++) { this[r][c] = Board.emptyCell; }
        }
        
        Board.onCreate.trigger(this);
    }
    Board.onCreate = new Event();
    Board.emptyCell = { isEmpty: true, destroy: function() { } };
    
    function Game() {
        var backRow = [ "rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook" ];
        
        this.board = new Board();
        
        this.reset = function() {
            for(var r = 0; r < 8; r++) {
                for(var c = 0; c < 8; c++) { this.board[r][c].destroy(); }
            }
            
            for(var c = 0; c < 8; c++) {
                new Piece(backRow[c], "black", 7, c, this.board);
                new Piece("pawn", "black", 6, c, this.board);
                new Piece("pawn", "white", 1, c, this.board);
                new Piece(backRow[c], "white", 0, c, this.board);
            }
        };
        
        this.reset();
        
        Game.onCreate.trigger(this);
    }
    Game.onCreate = new Event();
    
    context.Piece = Piece;
    context.Board = Board;
    context.Game = Game;
})(typeof exports === "object" ? exports : (window.kfc = {}));