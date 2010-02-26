(function(context) {
    function Event(ctx) {
        var listeners = [];
        
        this.add = function(listener) { listeners.push(listener); };
        
        this.trigger = function trigger(e) {
            for(var i = 0; i < listeners.length; i++) { listeners[i].call(ctx, e, ctx); }
        };
    }
    
    function Block(board, row, col, color) {
        color = color || "";
        
        this.board = board;
        
        this.onColorChange = new Event(this);
        this.color = function() { 
            if(!arguments.length) { return color; }
            
            color = arguments[0];
            
            this.onColorChange.trigger(color);
        };
        
        this.isEmpty = false;
        
        this.onMove = new Event(this);
        this.pos = function() {
            if(!arguments.length) { return { row: row, col: col }; }
            
            board[row][col] = board.emptyBlock(row, col); // Empty old position;
            
            row = arguments[0];
            col = arguments[1];
            
            board[row][col].destroy(); // Destroy any block at new position
            board[row][col] = this; // Move to new position
            
            this.onMove.trigger({ row: row, col: col });
        };
        
        this.onDestroy = new Event(this);
        this.destroy = function() {
            if(row == null || col == null) { return; }
            
            board[row][col] = board.emptyBlock(row, col);
            col = row = null;
            color = "";
            
            this.onDestroy.trigger();
            
            return true;
        };
        
        Block.onCreate.trigger(this);
        
        board[row][col] = this;
    }
    Block.onCreate = new Event();

    function EmptyBlock(board, row, col) {    
        this.color = function() {
            if(!arguments.length) { return ""; }
            
            board[row][col] = new Block(board, row, col, arguments[0]);
        }
        
        this.isEmpty = true;
        
        this.pos = function() { };
        
        this.destroy = function() { return false; };
    }

    function Board(rows, columns) {
        this.rows = rows;
        this.columns = columns;
        
        this.emptyBlock = function(row, col) {
            return new EmptyBlock(this, row, col);
        };
        
        Board.onCreate.trigger(this);
        
        for(var r = -1; r <= rows; r++) {
            this[r] = [];
            
            for(var c = -1; c <= columns; c++) {
                this[r][c] = this.emptyBlock(r, c);
            }
        }
    }
    Board.onCreate = new Event();
    
    var Piece = (function() {
        var colors = ["green", "blue", "red"];
        
        function Piece(board, blocks) {
            this.board = board;
        
            this.row = 0;
            this.col = 4;
            
            this.isFalling = true;
                        
            this.onPlacement = new Event(this);
            
            board[0][4].color(colors[blocks[0]]);
            board[1][4].color(colors[blocks[1]]);
            board[2][4].color(colors[blocks[2]]);
            
            return this;
        };
        
        Piece.prototype.left = function left() {
            var row = this.row, col = this.col, board = this.board;
            
            if(col - 1 < 0) { return; }
            if(!board[row + 0][col - 1].isEmpty) { return; }
            if(!board[row + 1][col - 1].isEmpty) { return; }
            if(!board[row + 2][col - 1].isEmpty) { return; }
            
            board[row + 0][col].pos(row + 0, col - 1);
            board[row + 1][col].pos(row + 1, col - 1);
            board[row + 2][col].pos(row + 2, col - 1);
            
            this.col -= 1;
        };
        
        Piece.prototype.rotate = function rotate() {
            var row = this.row, col = this.col, board = this.board;
            
            var tmp = board[row][col].color();
            board[row][col].color(board[row + 1][col].color());
            board[row + 1][col].color(board[row + 2][col].color());
            board[row + 2][col].color(tmp);
        };
        
        Piece.prototype.right = function right() {
            var row = this.row, col = this.col, board = this.board;
            
            if(col + 1 >= board.columns) { return; }
            if(!board[row + 0][col + 1].isEmpty) { return; }
            if(!board[row + 1][col + 1].isEmpty) { return; }
            if(!board[row + 2][col + 1].isEmpty) { return; }
            
            board[row + 0][col].pos(row + 0, col + 1);
            board[row + 1][col].pos(row + 1, col + 1);
            board[row + 2][col].pos(row + 2, col + 1);
            
            this.col += 1;
        };
        
        Piece.prototype.down = function down() {
            var row = this.row, col = this.col, board = this.board;
            
            this.isFalling = false;
            if(row + 3 >= board.rows) { this.onPlacement.trigger(); return; }
            if(!board[row + 3][col].isEmpty) { this.onPlacement.trigger(); return; }
            this.isFalling = true;
                            
            board[row + 2][col].pos(row + 3, col);
            board[row + 1][col].pos(row + 2, col);
            board[row + 0][col].pos(row + 1, col);
            
            this.row += 1;
        };
        
        Piece.colors = colors;
        
        Piece.isRoomAvailable = function isRoomAvailable(board) {
            if(!board[0][4].isEmpty) { return false; }
            if(!board[1][4].isEmpty) { return false; }
            if(!board[2][4].isEmpty) { return false; }
            
            return true;
        };
        
        return Piece;
    })();

    function compactBoard(board) {
        var wasCompressed = false;
        
        for(var r = board.rows - 1; r > 0; r--) {
            for(var c = 0; c < board.columns; c++) {
                if(board[r][c].isEmpty && !board[r - 1][c].isEmpty) {
                    board[r - 1][c].pos(r, c);
                    wasCompressed = true;
                }
            }
        }
        
        return wasCompressed;
    }

    function findMatches(board) {
        var scores = [];
        
        for(var r = 0; r < board.rows; r++) {
            for(var c = 0; c < board.columns; c++) {
                var tests = [ [ board[r - 1][c], board[r][c], board[r + 1][c] ],
                              [ board[r][c - 1], board[r][c], board[r][c + 1] ],
                              [ board[r - 1][c - 1], board[r][c], board[r + 1][c  + 1] ],
                              [ board[r + 1][c - 1], board[r][c], board[r - 1][c  + 1] ] ];
                
                for(var i = 0; i < tests.length; i++) {
                    var score = true;
                    
                    if(tests[i][0].isEmpty) { continue; }
                    
                    for(var j = 0; j < tests[i].length - 1; j++) {
                        if(tests[i][j].color() !== tests[i][j + 1].color()) { score = false; break; }
                    }
                    
                    if(score) { Array.prototype.push.apply(scores, tests[i]); }
                }
            }
        }
        
        for(var i = 0; i < scores.length; i++) { scores[i].destroy(); }
        
        return scores.length !== 0;
    }
    
    var Game = (function() {
        function Game() {
            this.board = new Board(15, 9);
            
            this.score = 0;
            
            this.colors = Piece.colors;
            
            this.piece = null;
            
            this.onFreeze = new Event(this);
        }
        
        Game.prototype.newPiece = function newPiece(blocks) {
            this.piece = new Piece(this.board, blocks);
            
            var game = this;
            this.piece.onPlacement.add(function() {
                var loop = setInterval(function() {
                    var wasCompressed = compactBoard(game.board);
                    if(wasCompressed) { return; }
                    
                    var scored = findMatches(game.board);
                    if(scored) { return; }
                    
                    game.onFreeze.trigger();
                    clearInterval(loop);
                }, 500);
            });
        };
        
        Game.prototype.isGameOver = function isGameOver() {
            return !Piece.isRoomAvailable(this.board);
        };
            
        return Game;
    })();
    
    context.Block = Block;
    context.Board = Board;
    context.Game = Game;
})(typeof exports === "object" ? exports : (window.blk = {}));