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
    
    var Piece = (function() {
        function onBoard(pos) {
            return 0 <= pos.row && pos.row < 8 && 0 <= pos.col && pos.col < 8;
        }
        
        function canOccupyGen(board, piece) {
            return function(m) { return board[m.row][m.col].isEmpty || board[m.row][m.col].color !== piece.color; };
        }
        
        var pieces = {};
        pieces["pawn"] = function() {
            var pos = this.pos(), row = pos.row, col = pos.col, board = this.board;
            var dir = (this.color === "black" ? -1 : 1);
            var moves = [ { row: row + dir, col: col + 1 }, { row: row + dir, col: col - 1 } ];
            moves = moves.filter(onBoard)
                         .filter(canOccupyGen(board, this))
                         .filter(function(m) { return !board[m.row][m.col].isEmpty; });
            if(board[row + dir][col].isEmpty) { 
                moves.push({ row: row + dir, col: col }); 
                
                if(!this.hasMoved && board[row + dir * 2][col].isEmpty) {
                    moves.push({ row: row + dir * 2, col: col }); 
                }
            }
            
            if((row === 3 && this.color === "black") || (row === 4 && this.color === "white")) { // En Passant Moves
                if(board[row][col + 1].isSubjectToEnPassant && board[row][col + 1].isStunned()) {
                    moves.push({ row: row + dir, col: col + 1 }); 
                }
                if(board[row][col - 1].isSubjectToEnPassant && board[row][col - 1].isStunned()) {
                    moves.push({ row: row + dir, col: col - 1 }); 
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
            var pos = this.pos(), row = pos.row, col = pos.col, board = this.board;
            var moves = [ { row: row + 1, col: col - 1 }, { row: row + 1, col: col }, { row: row + 1, col: col + 1 },
                          { row: row,     col: col - 1 },                             { row: row,     col: col + 1 },
                          { row: row - 1, col: col - 1 }, { row: row - 1, col: col }, { row: row - 1, col: col + 1 } ];
            
            if(!this.hasMoved) { // Adding moves for castling
                var castleRow = (this.color === "white" ? 0 : 7);
                
                // Check king side castle
                if(board[row][7].type === "rook" && !board[row][7].hasMoved && 
                   board[row][5].isEmpty && board[row][6].isEmpty) {
                    moves.push({ row: castleRow, col: 6 }); 
                }
                
                // check queen side castle
                if(board[row][0].type === "rook" && !board[row][0].hasMoved && 
                   board[row][1].isEmpty && board[row][2].isEmpty && board[row][3].isEmpty) {
                    moves.push({ row: castleRow, col: 2 });
                }
            }
            
            return moves.filter(onBoard).filter(canOccupyGen(this.board, this));
        };
        
        function Piece(type, color, row, col, board) {
            this.board = board;
            
            this.type = type;
            
            this.color = color;
            
            this.hasMoved = false;
            
            this.lastMoved = 0;
            
            this.isStunned = function() { return ((new Date()).getTime() - this.lastMoved) < 5000; }
            
            this.onTypeChange = event.create(this);
            
            this.onMove = event.create(this);
            
            this.onDestroy = event.create(this);
            
            this.pos = function() {
                if(arguments.length === 0) { return { row: row, col: col }; }
                
                if(row == arguments[0] && col == arguments[1]) { return; }
                
                board[row][col] = Board.emptyCell;
                
                var oldPos = { row: row, col: col };
                
                row = arguments[0];
                col = arguments[1];
                
                board[row][col].destroy("captured");
                board[row][col] = this;
                
                var firstMove = !this.hasMoved;
                this.hasMoved = true;
                
                this.onMove.trigger({ source: arguments[2], 
                                      firstMove: firstMove,
                                      oldPos: oldPos, 
                                      newPos: { row: row, col: col } });
                this.lastMoved = new Date();
            };
            
            this.availableMoves = pieces[type];
            
            this.destroy = function(e) {
                var pos = this.pos();   
                
                this.board[pos.row][pos.col] = Board.emptyCell;
                row = -1; col = -1;
                
                this.onDestroy.trigger(e);
            };
            
            this.onTypeChange(function(e) { this.availableMoves = pieces[this.type]; });
            
            Piece.onCreate.trigger(this);
            
            board[row][col] = this;
            this.onMove.trigger({ source: "creation", newPos: { row: row, col: col } });
        }
        Piece.onCreate = event.create();
        
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
    Board.onCreate = event.create();
    Board.emptyCell = { isEmpty: true, pos: function() {}, destroy: function() { } };
    
    var Game = (function() {
        var backRow = [ "rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook" ];
    
        function Game() {            
            this.board = new Board();
            
            this.isOver = false;
            
            this.reset();
            
            this.onGameOver = event.create(this);
            
            this.onGameOver(function(e) { this.isOver = e; });
            Game.onCreate.trigger(this);
        }
        Game.onCreate = event.create();
        
        (function() { //Reset
            function checkForQueening(e) {
                if(e.newPos.row !== 0 && e.newPos.row !== 7) { return; }
                
                this.type = "queen";
                this.onTypeChange.trigger();
            }
            
            function checkForEnPassant(e) {
                var row = e.newPos.row, col = e.newPos.col;
                this.isSubjectToEnPassant = (e.firstMove && (row === 3 || row === 4));
                
                if(!e.firstMove && (row === 2 || row === 5)) { // Checking for En Passant
                    var dir = (this.color === "black" ? -1 : 1);
                    
                    if(this.board[row - dir][col].type !== "pawn") { return; }
                    if(this.board[row - dir][col].color === this.color) { return; }
                    if(!this.board[row - dir][col].isStunned()) { return; }
                    
                    // I just committed en passant, so destroy passer by
                    this.board[row - dir][col].destroy("captured");
                }
            }
            
            function checkForCastling(e) {
                if(!e.firstMove) { return; }
                
                var row = e.newPos.row, col = e.newPos.col;
                if(col !== 2 && col !== 6) { return; }
                
                var rook = { row: row, col: (col === 2 ? 0 : 7 ) };
                this.board[rook.row][rook.col].pos(row, (rook.col === 7 ? 5 : 3 ));
            }
            
            Game.prototype.reset = function() {
                for(var r = 0; r < 8; r++) {
                    for(var c = 0; c < 8; c++) { this.board[r][c].destroy("reset"); }
                }
                
                for(var c = 0; c < 8; c++) {
                    new Piece(backRow[c], "black", 7, c, this.board);
                    (new Piece("pawn", "black", 6, c, this.board)).onMove(checkForEnPassant).add(checkForQueening);
                    (new Piece("pawn", "white", 1, c, this.board)).onMove(checkForEnPassant).add(checkForQueening);
                    new Piece(backRow[c], "white", 0, c, this.board);
                }
                
                var whiteKing = this.board[0][4], blackKing = this.board[7][4];
                
                whiteKing.onMove(checkForCastling);
                blackKing.onMove(checkForCastling);
                
                var game = this;
                whiteKing.onDestroy(function(e) {
                    if(e === "captured") { game.onGameOver.trigger(this.color); }
                });
                blackKing.onDestroy(function(e) {
                    if(e === "captured") { game.onGameOver.trigger(this.color); } 
                });
                this.isOver = false;
            };
        })();
        
        return Game;
    })();
    
    context.Piece = Piece;
    context.Board = Board;
    context.Game = Game;
})(typeof exports === "object" ? exports : (window.kfc = {}));