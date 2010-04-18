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
    
    function Block(board, row, col, color) {
        color = color || "";
        
        this.board = board;
        
        this.onColorChange = event.create(this);
        this.color = function() { 
            if(!arguments.length) { return color; }
            
            color = arguments[0];
            
            this.onColorChange.trigger(color);
        };
        
        this.isEmpty = false;
        
        this.onMove = event.create(this);
        this.pos = function() {
            if(!arguments.length) { return { row: row, col: col }; }
            
            board[row][col] = board.emptyBlock(row, col); // Empty old position;
            
            row = arguments[0];
            col = arguments[1];
            
            board[row][col].destroy(); // Destroy any block at new position
            board[row][col] = this; // Move to new position
            
            this.onMove.trigger({ row: row, col: col });
        };
        
        this.onDestroy = event.create(this);
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
    Block.onCreate = event.create();

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
    Board.onCreate = event.create();
    
    var Piece = (function() {
        var colors = ["green", "blue", "red"];
        
        function Piece(board) {
            this.board = board;
        
            this.row = 0;
            this.col = 4;
            
            this.isFalling = false;
            
            this.onCreate = event.create(this);
            
            this.onMove = event.create(this);
            
            this.onPlacement = event.create(this);
        }
        
        Piece.prototype.create = function(blocks, source) {
            var board = this.board;
            
            this.row = 0;
            this.col = 4;
            
            this.isFalling = true;
            
            board[0][4].color(colors[blocks[0]]);
            board[1][4].color(colors[blocks[1]]);
            board[2][4].color(colors[blocks[2]]);
            
            this.onCreate.trigger({ blocks: blocks, source: source });
        };
        
        Piece.prototype.left = function left(source) {
            var row = this.row, col = this.col, board = this.board;
            
            if(col - 1 < 0) { return; }
            if(!board[row + 0][col - 1].isEmpty) { return; }
            if(!board[row + 1][col - 1].isEmpty) { return; }
            if(!board[row + 2][col - 1].isEmpty) { return; }
            
            board[row + 0][col].pos(row + 0, col - 1);
            board[row + 1][col].pos(row + 1, col - 1);
            board[row + 2][col].pos(row + 2, col - 1);
            
            this.col -= 1;
            
            this.onMove.trigger({ dir: "left", source: source });
        };
        
        Piece.prototype.rotate = function rotate(source) {
            var row = this.row, col = this.col, board = this.board;
            
            var tmp = board[row][col].color();
            board[row][col].color(board[row + 1][col].color());
            board[row + 1][col].color(board[row + 2][col].color());
            board[row + 2][col].color(tmp);
            
            this.onMove.trigger({ dir: "rotate", source: source });
        };
        
        Piece.prototype.right = function right(source) {
            var row = this.row, col = this.col, board = this.board;
            
            if(col + 1 >= board.columns) { return; }
            if(!board[row + 0][col + 1].isEmpty) { return; }
            if(!board[row + 1][col + 1].isEmpty) { return; }
            if(!board[row + 2][col + 1].isEmpty) { return; }
            
            board[row + 0][col].pos(row + 0, col + 1);
            board[row + 1][col].pos(row + 1, col + 1);
            board[row + 2][col].pos(row + 2, col + 1);
            
            this.col += 1;
            
            this.onMove.trigger({ dir: "right", source: source });
        };
        
        Piece.prototype.down = function down(source) {
            var row = this.row, col = this.col, board = this.board;
            
            this.isFalling = false;
            if(row + 3 >= board.rows) { this.onPlacement.trigger({ row: row, col: col }); return; }
            if(!board[row + 3][col].isEmpty) { this.onPlacement.trigger({ row: row, col: col }); return; }
            this.isFalling = true;
                            
            board[row + 2][col].pos(row + 3, col);
            board[row + 1][col].pos(row + 2, col);
            board[row + 0][col].pos(row + 1, col);
            
            this.row += 1;
            
            this.onMove.trigger({ dir: "down", source: source });
        };
        
        Piece.prototype.move = function(pos, source) {
            var row = this.row, col = this.col, board = this.board;
            
            board[row + 0][col].pos(pos.row + 0, pos.col);
            board[row + 1][col].pos(pos.row + 1, pos.col);
            board[row + 2][col].pos(pos.row + 2, pos.col);
            
            this.onMove.trigger({ dir: "???", source: source });
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
        function physicsLoop(game) {
            var wasCompressed = compactBoard(game.board);
            if(wasCompressed) { return true; }
            
            var scored = findMatches(game.board);
            if(scored) { return true; }
            
            game.onFreeze.trigger();
            return false;
        }
        
        function instantPhysics() {
            while(physicsLoop(this));
        }
        
        function timedPhysics() {
            if(this.physicsTimer) { return; }
            
            var game = this;
            var loop = setInterval(function() {                    
                if(!physicsLoop(game)) { clearInterval(loop); game.physicsTimer = null; }
            }, 500);
            
            this.physicsTimer = loop;
        }
        
        function Game(useInstantPhysics) {
            var actions = [];
            
            this.board = new Board(15, 9);
            
            this.score = 0;
            
            this.piece = new Piece(this.board);
            
            this.isFrozen = true;
            
            this.onFreeze = event.create(this);
            
            this.runPhysics = (useInstantPhysics ? instantPhysics : timedPhysics);
            
            this.runAction = function(action) {
                if(useInstantPhysics || this.isFrozen) { action(this); }
                else { actions.push(action); }
            };
            
            var game = this;
            this.piece.onPlacement.add(function() {
                game.isFrozen = false;
                game.runPhysics(); 
            });
            this.onFreeze.add(function() { game.isFrozen = true; });
            this.onFreeze.add(function() {
                if(actions.length > 0) { (actions.shift())(this); } 
            });
        }
        
        Game.colors = Piece.colors;
        
        Game.prototype.reset = function reset() {
            this.piece.isFalling = false;
            this.isFrozen = true;
            clearInterval(this.physicsTimer);
        
            for(var r = 0; r < this.board.rows; r++) {
                for(var c = 0; c < this.board.columns; c++) {
                    this.board[r][c].destroy(); 
                }
            }
        }
        
        Game.prototype.isGameOver = function isGameOver() {
            return !Piece.isRoomAvailable(this.board);
        };
            
        return Game;
    })();
    
    context.Block = Block;
    context.Board = Board;
    context.Game = Game;
})(typeof exports === "object" ? exports : (window.blk = {}));