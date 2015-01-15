(function(parentModule) {
if (parentModule.SolveThis) return;

//===================================================
// SolveThis consists of the following components:
//  View - Draws the UI and handles events
//  Model - Maintains the state of a game
//  Map - Describes the initial state of a game
//  Solver - Look for a solution using some heuristics
//===================================================
var SolveThis = parentModule.SolveThis = {};

//===================================================
// Helper functions and classes
//===================================================
function assert(cond) {
    if (!cond) throw 'assertion failed';
}

function randInt(max) {
    return Math.floor(Math.random() * max);
}

var slice = [].slice;

// Simplified Events class from Backbone.js
var Events = {
    on: function(name, callback, context) {
        this._events || (this._events = {});
        var events = this._events[name] || (this._events[name] = []);
        events.push({callback: callback, context: context || this});
        return this;
    },
    trigger: function(name) {
        if (!this._events) return this;
        var events = this._events[name];
        if (!events) return this;
        var args = slice.call(arguments, 1);
        for (var ei = 0; ei < events.length; ei++) {
            var ev = events[ei];
            ev.callback.apply(ev.context, args);
        }
        return this;
    }
};

//===================================================
// View
//===================================================
SolveThis.View = function(parentEl, options) {
    options || (options = {});
    this._width = options.width || 380;

    this._initView(parentEl);

    this.model = new SolveThis.Model(this, options);
    this.model.on('map-changed', function() {
        this._stopPlaying();
        this._initSVG(this._width);
        this._redrawSlides();
        this._setStep(0);
    }, this);
    this.model.on('slides-changed', this._redrawSlides, this);
    this.model.on('steps-changed', this._setStep, this);
    // map-loading triggers view redrawing
    if (options.map)
        this.model.loadMap(options.map);
    else
        this._chooseRandomMap();

    this._initEvents();
};
_.extend(SolveThis.View.prototype, {
    _setStep: function() {
        var stepsEl = this._el.getElementsByClassName('solvethis-steps')[0]
                        .getElementsByTagName('p')[0];
        stepsEl.innerText = '' + this.model.steps();
    },
    _initSVG: function(width) {
        if (this._svgEl) this._svgEl.remove();

        var map = this.model.map();
        // coordinates
        var rows = map.rows(), cols = map.cols();
        var gridMarginRatio = 8;
        var margin = width / (cols * gridMarginRatio + (cols + 1));
        var grid = margin * gridMarginRatio;
        var height = rows * grid + (rows + 1) * margin;

        // head
        var headTemplate = _.template(
            '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" ' +
                'class="solvethis-svg" ' +
                'width="<%= width %>px" height="<%= height %>px" >');
        var headHtml = headTemplate({width: width, height: height});

        // map consists of tiles
        this._tileX = function(row) {
            return margin + row * (grid + margin);
        }
        this._tileY = function(col) {
            return margin + col * (grid + margin);
        }
        var tileHtmls = [];
        var tileTemplate = _.template(
            '<rect width="<%= w %>px" height="<%= h %>px" ' +
                'x="<%= x %>px" y="<%= y %>px" ' +
                'class="solvethis-tile <%= state %>" >' +
            '</rect>');
        for (var ri = 0; ri < rows; ri++) {
            for (var ci = 0; ci < cols; ci++) {
                var state = map.at(ri, ci);
                var stateCss = state == 'X' ? 'occupied' :
                                state == '_' ? 'target' : '';

                var newTileHtml = tileTemplate({
                    w: grid,
                    h: grid,
                    x: this._tileY(ci),
                    y: this._tileX(ri),
                    state: stateCss
                });
                tileHtmls.push(newTileHtml);
            }
        }
        var tilesHtml = tileHtmls.join('\n');

        // slides are movable tiles
        var slideTemplate = _.template(
            '<g class="solvethis-slide slide-<%= slide_id %>" ' +
                'transform="translate(<%= x %>,<%= y %>)">' +
                '<polygon points="0,0 <%= w %>,0 0,<%= w %>" ' +
                        'class="upper-left"/>' +
                '<polygon points="<%= w %>,0 <%= w %>,<%= w %> ' +
                    '<%= 0 %>,<%= w %>" class="lower-right">' +
            '</g>');
        var slideHtmls = [];
        var slides = this.model.slides().length;
        for (var si = 0; si < slides; si++) {
            var newSlideHtml = slideTemplate({
                slide_id: si,
                x: 0,
                y: 0,
                w: grid
            });
            slideHtmls.push(newSlideHtml);
        }
        var slidesHtml = slideHtmls.join('\n');

        // tail
        var tailHtml = '</svg>';

        // append the svg to parent
        var svgHtml = headHtml + tilesHtml + slidesHtml + tailHtml;
        this._mainEl.innerHTML = svgHtml;
        this._svgEl = this._mainEl.children[0];
    },
    _initView: function(parentEl) {
        var topHtml =   '<div class="solvethis-top">' +
                            '<button class="left fa fa-question"></button>' +
                            '<div class="solvethis-steps">' +
                                '<h1>STEP</h1>' +
                                '<p>0</p>' +
                            '</div>' +
                            '<button class="right fa fa-rotate-left"></button>' +
                         '</div>';
        var mainHtml =  '<div class="solvethis-main"></div>';
        var bottomHtml ='<div class="solvethis-bottom">' +
                            '<sub>Confident with your brainpower? ' +
                                'Solve it yourself.</sub>' +
                            '<div class="solvethis-bottom-group">' +
                                '<button class="fa fa-arrow-left"></button>' +
                                '<button class="fa fa-arrow-down"></button>' +
                                '<button class="fa fa-arrow-up"></button>' +
                                '<button class="fa fa-arrow-right"></button>' +
                            '</div>' +
                            '<sub>Or let the algorithm help you. ' +
                                'Sorry to spoil the fun!</sub>' +
                            '<div class="solvethis-bottom-group">' +
                                '<button class="fa fa-play">&nbsp;SolveThis!</button>' +
                            '</div>' +
                        '</div>';

        var viewHtml = topHtml + mainHtml + bottomHtml;

        var el = this._el = document.createElement('div');
        el.className = "solvethis-view";
        el.innerHTML = viewHtml;

        this._mainEl = el.getElementsByClassName('solvethis-main')[0];
        window.mainEl = this._mainEl;

        this._parentEl = parentEl;
        parentEl.appendChild(el);
    },
    _initEvents: function() {
        var that = this;
        // Keyboard events
        var codes = {
            37: 'left',
            38: 'up',
            39: 'right',
            40: 'down'
        };
        document.addEventListener('keydown', function(event) {
            var dir = codes[event.keyCode];
            if (dir) {
                that._stopPlaying();
                that.model.move(dir);
                event.preventDefault();
            }
        });
        // Click events
        var quesBtn = this._el.getElementsByClassName('fa-question')[0];
        quesBtn.addEventListener('click', function(event) {
            that._stopPlaying();
            that._chooseRandomMap();
        });
        var resetBtn = this._el.getElementsByClassName('fa-rotate-left')[0];
        resetBtn.addEventListener('click', function(event) {
            that._stopPlaying();
            that.model.reset();
        });
        var leftBtn = this._el.getElementsByClassName('fa-arrow-left')[0];
        leftBtn.addEventListener('click', function(event) {
            that.left();
        });
        var rightBtn = this._el.getElementsByClassName('fa-arrow-right')[0];
        rightBtn.addEventListener('click', function(event) {
            that.right();
        });
        var upBtn = this._el.getElementsByClassName('fa-arrow-up')[0];
        upBtn.addEventListener('click', function(event) {
            that.up();
        });
        var downBtn = this._el.getElementsByClassName('fa-arrow-down')[0];
        downBtn.addEventListener('click', function(event) {
            that.down();
        });
        var solveBtn = this._el.getElementsByClassName('fa-play')[0];
        solveBtn.addEventListener('click', function(event) {
            that.solve();
        });
    },
    _redrawSlides: function(animated) {
        var slides = this.model.slides();
        var map = this.model.map();
        for (var si = 0; si < slides.length; si++) {
            var slide = slides[si];
            var slide_ui = this._svgEl.querySelector('.slide-' + si);
            var x = this._tileX(slide.col);
            var y = this._tileY(slide.row);
            slide_ui.setAttribute('transform', 'translate(' + x + ',' + y + ')');

            var onTarget = map.at(slide.row, slide.col) == '_';
            if (onTarget) slide_ui.classList.add('on-target');
            else slide_ui.classList.remove('on-target');
        }
    },
    _chooseRandomMap: function() {
        var pool = SolveThis.Map.PREDEFINED;
        var id;
        while ((id = randInt(pool.length)) == this._lastMapId);
        this._lastMapId = id;
        var newMap = pool[id];
        this.model.loadMap(newMap);
    },
    left: function() {
        this._stopPlaying();
        this.model.move('left');
    },
    right: function() {
        this._stopPlaying();
        this.model.move('right');
    },
    up: function() {
        this._stopPlaying();
        this.model.move('up');
    },
    down: function() {
        this._stopPlaying();
        this.model.move('down');
    },
    solve: function() {
        this._stopPlaying();

        var map = this.model.map();

        var slidesMapMask = new SolveThis.Solver.MapMask();
        var slides = this.model.slides();
        for (var si in slides) {
            var sl = slides[si];
            slidesMapMask.set(sl.row, sl.col);
        }

        var evalMin = 0, evalMax = 80;
        var type = 'astar';
        var evalFunc = SolveThis.createEvalFunc(type, map, evalMin, evalMax);

        var options = {maxDepth: evalMax};
        var solver = new SolveThis.Solver(options);
        var solution = solver.run(map, evalFunc, slidesMapMask);
        if (solution == null) {
            alert('Can\'t find any solution!');
            return;
        }

        // play the solution
        var steps = 1;
        var that = this;
        this._playing = setInterval(function() {
            if (steps >= solution.length) {
                that._stopPlaying();
                return;
            }

            var state = solution[steps++];
            that._setSlidesByMapMask(state.mapMask);
        }, 500);
    },
    _setSlidesByMapMask: function(mapMask) {
        var slides = [];
        for (var ri = 0; ri < 8; ri++)
            for (var ci = 0; ci < 8; ci++)
                if (mapMask.get(ri, ci))
                    slides.push({row: ri, col: ci});
        this.model.moveTo(slides);
    },
    _stopPlaying: function() {
        if (!this._playing) return;

        clearInterval(this._playing);
        this._playing = null;
    }
});

// ========================================
//  Model
// =======================================
SolveThis.Model = function(parent, options) {
    this._parent = parent;
    this._steps = 0;
};
_.extend(SolveThis.Model.prototype, Events, {
    // ========================================
    // Map loading function
    // =======================================
    loadMap: function(map) {
        // update variables
        this._map = map;
        this._rows = this._map.rows();
        this._cols = this._map.cols();
        this._resetSlides();
        this._steps = 0;

        // update UI
        this.trigger('map-changed');
    },
    // ========================================
    // State manipluation functions
    // =======================================
    reset: function() {
        this._steps = 0;
        this.trigger('steps-changed');
        this._resetSlides();
        this.trigger('map-changed');
    },
    moveTo: function(slides) {
        this._slides = slides;

        this.trigger('slides-changed');
        this._steps++;
        this.trigger('steps-changed');
    },
    move: function(direction) {
        if (direction == 'left') {
            for (var ci = 1; ci < this._cols; ci++) {
                for (var si = 0; si < this._slides.length; si++) {
                    var slide = this._slides[si];
                    if (slide.col != ci) continue;
                    this._move(si, direction);
                }
            }
        }
        else if (direction == 'right') {
            for (var ci = this._cols - 2; ci >= 0; ci--) {
                for (var si = 0; si < this._slides.length; si++) {
                    var slide = this._slides[si];
                    if (slide.col != ci) continue;
                    this._move(si, direction);
                }
            }
        }
        else if (direction == 'up') {
            for (var ri = 1; ri < this._rows; ri++) {
                for (var si = 0; si < this._slides.length; si++) {
                    var slide = this._slides[si];
                    if (slide.row != ri) continue;
                    this._move(si, direction);
                }
            }
        }
        else if (direction == 'down') {
            for (var ri = this._rows - 2; ri >= 0; ri--) {
                for (var si = 0; si < this._slides.length; si++) {
                    var slide = this._slides[si];
                    if (slide.row != ri) continue;
                    this._move(si, direction);
                }
            }
        }
        else throw "unexpected direction `" + direction + "`";
        this.trigger('slides-changed');
        this._steps++;
        this.trigger('steps-changed');
    },
    // ========================================
    // `Get `Functions
    // =======================================
    map: function() {
        return this._map;
    },
    slides: function() {
        return this._slides;
    },
    steps: function() {
        return this._steps;
    },
    // ========================================
    // Private functions
    // =======================================
    _resetSlides: function() {
        this._slides = [];
        for (var ri = 0; ri < this._rows; ri++) {
            for (var ci = 0; ci < this._cols; ci++) {
                // find a slide
                if (this._map.at(ri, ci) == '.') {
                    this._slides.push({row: ri, col: ci});
                }
            }
        }
    },
    _move: function(slide_id, direction) {
        var slide = this._slides[slide_id];
        var new_row = slide.row, new_col = slide.col;
        if (direction == 'left') new_col--;
        else if (direction == 'right') new_col++;
        else if (direction == 'up') new_row--;
        else if (direction == 'down') new_row++;

        if (this._isTileEmpty(new_row, new_col)) {
            slide.row = new_row; slide.col = new_col;
        }
    },
    _isTileEmpty: function(row, col) {
        if (row < 0 || row >= this._rows) return false;
        if (col < 0 || col >= this._cols) return false;
        if (this._map.at(row, col) == 'X') return false;

        for (var si = 0; si < this._slides.length; si++) {
            var slide = this._slides[si];
            if (slide.row == row && slide.col == col) return false;
        }

        return true;
    }
});

// ========================================
//  Map
//
//  Symbols
//  ' ' - empty square
//  '.' - starting square
//  'X' - blocked square
//  '_' - target square
//
//  Initially, there is one slide on each starting square. The # of staring
//  squares is equal to the # of target squares. The goal of this game is to
//  move all slides, which are at the starting squares, to the target squares
//  eventually, in as few steps as possible.
//
//  In each step, the slides as a whole can be moved to left, right, up or
//  down. Naturally, you cannot move the slides out of board. To make the game
//  interesting, there are some blocked squares on the board, to which slides
//  cannot be moved.
// =======================================
SolveThis.Map = function(data) {
    this._data = data;
    this._rows = data.length;
    this._cols = data[0].length;
};
_.extend(SolveThis.Map.prototype, {
    cols: function() {
        return this._rows;
    },
    rows: function() {
        return this._cols;
    },
    at: function(row, col) {
        // invisible walls on the four sides
        if (row < 0 || row >= this._rows ||
            col < 0 || col >= this._cols)
            return 'X';
        return this._data[row][col];
    },
    each: function(func) {
        for (var r = 0; r < this._rows; r++)
            for (var c = 0; c < this._cols; c++)
                func(r, c, this._data[r][c]);
    }
});

// ===========================================================
//  Solver
//
//   Explore the search space for a solution using best-first
//   strategy. The exact meaning of 'best' is defined by
//   evaluation function.
// ===========================================================
SolveThis.Solver = function(options) {
    this._options = options;
};
_.extend(SolveThis.Solver.prototype, {
    _initialize: function(map, evalFunc, slidesMapMask) {
        // init starting state
        var startingMapMask = slidesMapMask;
        if (!startingMapMask) {
            startingMapMask = new SolveThis.Solver.MapMask();
            map.each(function(r, c, square) {
                if (square == '.') startingMapMask.set(r, c);
            });
        }
        var startingState = this._startingState = getState(startingMapMask);

        // init target state
        var mapMask = new SolveThis.Solver.MapMask();
        map.each(function(r, c, square) {
            if (square == '_') mapMask.set(r, c);
        });
        var targetState = this._targetState = getState(mapMask);
        window.targetState = targetState;

        this._openStates = new SolveThis.Solver.PriorityQueue(evalFunc,
                                                           this._options);
        startingState.depth = 0;
        this._openStates.push(startingState);
    },
    // A* algorithm is a best-first search that guarantees to find the optimal
    // solution in a tree-structured search space
    run: function(map, evalFunc, slidesMapMask) {
        initStates();

        this._initialize(map, evalFunc, slidesMapMask);

        var exploredStatesCount = 0;
        var examinedStatesCount = 0;

        while (1) {
            if (exploredStatesCount % 100000 == 0)
                console.debug(exploredStatesCount);
            if (exploredStatesCount > 4000000) return null;

            // pop the most-promising state to explore
            var currentState = this._openStates.pop();
            if (currentState == null) {
                console.debug('no solution');
                return null; // no solution
            }
            // this._printState(currentState, map);

            examinedStatesCount += 1;
            // find the optimal solution
            if (currentState == this._targetState)
                break;

            // explore neighbor states
            var neighborStates = currentState.exploreNeighbor(map);
            for (var ni in neighborStates) {
                exploredStatesCount += 1;
                var ns = neighborStates[ni];
                var newDepth = currentState.depth + 1;
                // if find a shorter path to the state
                if (ns.depth < 0 || newDepth < ns.depth) {
                    ns.depth = newDepth;
                    ns.preState = currentState;
                    this._openStates.push(ns);
                }
            }
        }
        console.debug('success');
        console.debug('# of explored states = ' + exploredStatesCount);
        console.debug('# of examined states = ' + examinedStatesCount);
        var path = this._targetState.path();
        this._printPath(path, map);
        return path;
    },
    _printPath: function(path, map) {
        for (var pi = 0; pi < path.length; pi++) {
            var s = path[pi];
            console.debug('<step ' + pi + '>');
            this._printState(s, map);
        }
    },
    _printState: function(state, map) {
        var mapMask = state.mapMask;
        for (var ri = 0; ri < 8; ri++) {
            var row = ri + '|';
            for (var ci = 0; ci < 8; ci++) {
                var square;
                if (mapMask.get(ri, ci)) square = 'S';
                else {
                    square = map.at(ri, ci);
                    if (square == '.') square = ' ';
                }
                row += square;
            }
            console.debug(row);
        }
    }
});


// ===========================================================
//  Evaluation functions
//
//      Types:
//          WFS - width-first search
//          DFS - depth-first search
//          Random - random-first search
//          AStar - A* search. Of course, this performs best
// ===========================================================
SolveThis.createEvalFunc = function(type, map, min, max) {
    var type = type.toLowerCase();
    if (type == 'wfs')
        return createWFSEvalFunc(map, min, max);
    else if (type == 'dfs')
        return createDFSEvalFunc(map, min, max);
    else if (type == 'random')
        return createRandomEvalFunc(map, min, max);
    else if (type == 'astar')
        return createAStarEvalFunc(map, min, max);
    throw 'unexpected type `' + type + '`'
};

// Width-first search
function createWFSEvalFunc(map, min, max) {
    assert(min < max);
    var evalFunc = function(state)
    {
        var val = min + state.depth;
        if (val > max) val = max;
        return val;
    }
    evalFunc.min = min; evalFunc.max = max;
    return evalFunc;
}

// Depth-first search
function createDFSEvalFunc(map, min, max) {
    assert(min < max);
    var evalFunc = function(state) {
        var val = max - state.depth;
        if (val < min) val = min;
        return val;
    }
    evalFunc.min = min; evalFunc.max = max;
    return evalFunc;
}

// Random search
function createRandomEvalFunc(map, min, max) {
    assert(min < max);
    var evalFunc = function(state)
    {
        return Math.floor(min + Math.random() * (max + 1 - min));
    }
    evalFunc.min = min; evalFunc.max = max;
    return evalFunc;
}

// A* search
function createAStarEvalFunc(map, min, max) {
    // Find out all target squares
    var targetSquares = [];
    map.each(function(r, c, s) {
        if (s == '_') targetSquares.push({r: r, c: c});
    });
    var numTargets = targetSquares.length;

    // Initialize the distance matrix
    var distTarget = new Array(8);
    for (var ri = 0; ri < 8; ri++) {
        distTarget[ri] = new Array(8);
        for (var ci = 0; ci < 8; ci++) {
            var dist = distTarget[ri][ci] = new Array(numTargets);
            for (var ti = 0; ti < numTargets; ti++)
                dist[ti] = -1;
        }
    }

    // Calculate the minimum distance to a target square from any squares
    // Four directions: UP, DN, LT, RT
    var dirs = [{r: -1, c: 0}, {r: 1, c: 0}, {r: 0, c: -1}, {r: 0, c: 1}];
    for (var ti = 0; ti < numTargets; ti++) {
        // dist(target, target) = 0
        var targetRi = targetSquares[ti].r;
        var targetCi = targetSquares[ti].c;
        distTarget[targetRi][targetCi][ti] = 0;

        // update distances to the target like a wave spreading from a center
        var waveFront = [{r: targetRi, c: targetCi}];
        while (waveFront.length > 0) {
            var newWaveFront = [];
            for (var wi = 0; wi < waveFront.length; wi++) {
                var square = waveFront[wi];
                var newDist = distTarget[square.r][square.c][ti] + 1;
                for (var di in dirs) {
                    var dir = dirs[di];
                    var neighbor = {r: square.r + dir.r, c: square.c + dir.c};
                    if (map.at(neighbor.r, neighbor.c) == 'X') continue;

                    var oldDist = distTarget[neighbor.r][neighbor.c][ti];
                    if (oldDist >= 0 && newDist > oldDist) continue;
                    distTarget[neighbor.r][neighbor.c][ti] = newDist;
                    newWaveFront.push(neighbor);
                }
            }
            waveFront = newWaveFront;
        }
    }

    for (var ri = 0; ri < 8; ri++) {
        for (var ci = 0; ci < 8; ci++) {
            var minDist = -1;
            for (var ti = 0; ti < numTargets; ti++) {
                var dist = distTarget[ri][ci][ti];
                if (dist < 0) continue;
                if (minDist < 0 || dist < minDist) minDist = dist;
            }
            distTarget[ri][ci] = minDist;
        }
    }

    var evalFunc = function(state) {
        var mapMask = state.mapMask;
        var maxMinDist = 0;
       for (var ri = 0; ri < 8; ri++) {
           for (var ci = 0; ci < 8; ci++) {
                if (!mapMask.get(ri, ci)) continue;

                var minDist = distTarget[ri][ci];
                assert(minDist >= 0);
                if (minDist > maxMinDist) maxMinDist = minDist;
           }
       }
       return state.depth + maxMinDist;
    };
    evalFunc.min = min; evalFunc.max = max;
    return evalFunc;
}

// =============================================
//  Priority queue that maintains open states
// ============================================
SolveThis.Solver.PriorityQueue = function(evalFunc, options) {
    assert(evalFunc);
    this._evalFunc = evalFunc;

    options = options || {};
    this._maxDepth = options.maxDepth || 14;

    var numPossibleEvals = evalFunc.max - evalFunc.min + 1;
    var queues = this._queues = new Array(numPossibleEvals);
    for (var qi = 0; qi < queues.length; qi++) {
        queues[qi] = new Queue();
    }

    this._size = 0;
    this._headQueueIndex = -1;
};
_.extend(SolveThis.Solver.PriorityQueue.prototype, {
    _eval2qidx: function(val) {
        return val - this._evalFunc.min;
    },
    // push a new state and update its evaluation
    push: function(state) {
        // remove the state from its previous queue
        if (state._eval != undefined) {
            var qidx = this._eval2qidx(state._eval);
            var queue = this._queues[qidx];
            queue.remove(state);
            delete state._eval;
            this._size--;

            if (qidx == this._headQueueIndex && queue.empty()) {
                this._headQueueIndex = this._findNextNonEmptyQueue(qidx);
            }
        }

        // discard `very bad` state
        if (state.depth > this._maxDepth) return;

        state._eval = this._evalFunc(state);
        assert(state._eval >= this._evalFunc.min);
        assert(state._eval <= this._evalFunc.max);

        var qidx = this._eval2qidx(state._eval);
        this._queues[qidx].push(state);
        this._size++;

        if (this._headQueueIndex < 0 || qidx < this._headQueueIndex) {
            this._headQueueIndex = qidx;
        }
    },
    // pop the state with the best evaluation
    pop: function() {
        if (this._size == 0) return null;

        var queue = this._queues[this._headQueueIndex];
        var state = queue.pop();
        delete state._eval;
        this._size--;
        if (queue.empty()) {
            this._headQueueIndex =
                this._findNextNonEmptyQueue(this._headQueueIndex);
        }
        return state;
    },
    _findNextNonEmptyQueue: function(afterQidx) {
        var qi = afterQidx + 1, qlen = this._queues.length;
        while (qi < qlen && this._queues[qi].empty())
            qi++;
        return qi < qlen ? qi : -1;
    }
});

function Queue() {
    var head = this._head = {_qpre: null, _qnext: null};
    var tail = this._tail = {_qpre: null, _qnext: null};
    head._qnext = tail;
    tail._qpre = head;

    this._size = 0;
};
_.extend(Queue.prototype, {
    pop: function() {
        if (this._size == 0) return null;

        var ele = this._tail._qpre;
        this.remove(ele);
        return ele;
    },
    push: function(ele) {
        assert(ele._qnext == undefined);
        assert(ele._qpre == undefined);
        var oldFirst = this._head._qnext;
        ele._qpre = this._head;
        ele._qnext = oldFirst;
        this._head._qnext = ele;
        oldFirst._qpre = ele;
        this._size ++;
    },
    remove: function(ele) {
        assert(ele._qnext);
        assert(ele._qpre);
        var oldPre = ele._qpre,
            oldNext = ele._qnext;
        oldPre._qnext = oldNext;
        oldNext._qpre = oldPre;
        delete ele._qpre;
        delete ele._qnext;
        this._size --;
    },
    empty: function() {
        return this._size == 0;
    },
    size: function() {
        return this._size;
    }
});

// =============================================
// MapMask
//  The masked part of a map is where slides are
// ============================================
SolveThis.Solver.MapMask = function() {
    this.clear();
};
_.extend(SolveThis.Solver.MapMask.prototype, {
    set: function(i, j) {
        var idx = i * 8 + j;
        if (idx < 32) this.LO |= 1 << idx;
        else this.HI |= 1 << (idx - 32);
    },
    get: function(i, j) {
        var idx = i * 8 + j;
        if (idx < 32) return (this.LO >> idx) & 1;
        else return (this.HI >> (idx - 32)) & 1;
    },
    clear: function() {
        this.HI = this.LO = 0;
    },
    equals: function(another) {
        if (another == null) return false;
        if (another == this) return true;
        return this.HI == another.HI && this.LO == another.LO;
    },
    toString: function() {
        var res = '';
        for (var ri = 0; ri < 8; ri++) {
            for (var ci = 0; ci < 8; ci++) {
                res += this.get(ri, ci) ? 'N' : '_';
            }
            res += '\n';
        }
        return res;
    }
});

// =========================================
// State
//  maintains the state of a game for solver
// =========================================
SolveThis.Solver.State = function(mapMask, preState, depth) {
    if (!mapMask) throw "mapMask cannot be null";
    this.mapMask = mapMask;
    this.preState = preState;
    this.depth = depth;
};
_.extend(SolveThis.Solver.State.prototype, {
    _directions: ['up', 'down', 'left', 'right'],
    path: function() {
        var states = [];
        var state = this;
        while (state) {
            states.push(state);
            state = state.preState;
        }
        return states.reverse();
    },
    exploreNeighbor: function(map) {
        var neighbors = [];
        for (var di in this._directions) {
            var dir = this._directions[di];
            var newMapMask = this._moveMask(this.mapMask, dir, map);
            if (newMapMask.equals(this.mapMask)) continue;
            if (this.preState && this.preState.mapMask.equals(newMapMask)) continue;
            neighbors.push(getState(newMapMask));
        }
        return neighbors;
    },
    _moveMask: function(mapMask, dir, map) {
        var resMapMask = new SolveThis.Solver.MapMask();
        var rows = map.rows(), cols = map.cols();
        if (dir == 'left') {
            for (var ci = 0; ci < cols; ci++) {
                for (var ri = 0; ri < rows; ri++) {
                    if (!mapMask.get(ri, ci)) continue;

                    // can move
                    if (map.at(ri, ci - 1) != 'X' && !resMapMask.get(ri, ci - 1))
                        resMapMask.set(ri, ci - 1);
                    else
                        resMapMask.set(ri, ci);
                }
            }
        }
        else if (dir == 'right') {
            for (var ci = cols - 1; ci >= 0; ci--) {
                for (var ri = 0; ri < rows; ri++) {
                    if (!mapMask.get(ri, ci)) continue;

                    // can move
                    if (map.at(ri, ci + 1) != 'X' && !resMapMask.get(ri, ci + 1))
                        resMapMask.set(ri, ci + 1);
                    else
                        resMapMask.set(ri, ci);
                }
            }
        }
        else if (dir == 'up') {
            for (var ri = 0; ri < rows; ri++) {
                for (var ci = 0; ci < cols; ci++) {
                    if (!mapMask.get(ri, ci)) continue;

                    if (map.at(ri - 1, ci) != 'X' && !resMapMask.get(ri - 1, ci))
                        resMapMask.set(ri - 1, ci);
                    else
                        resMapMask.set(ri, ci);
                }
            }
        }
        else if (dir == 'down') {
            for (var ri = rows - 1; ri >= 0; ri--) {
                for (var ci = 0; ci < cols; ci++) {
                    if (!mapMask.get(ri, ci)) continue;

                    if (map.at(ri + 1, ci) != 'X' && !resMapMask.get(ri + 1, ci))
                        resMapMask.set(ri + 1, ci);
                    else
                        resMapMask.set(ri, ci);
                }
            }
        }
        return resMapMask;
    }
});

// =========================================
// Factory pattern for State
// =========================================
function getState(mapMask) {
    var subset = getState._allStates[mapMask.HI];
    if (!subset) {
        subset = getState._allStates[mapMask.HI] = {};
    }
    var state = subset[mapMask.LO];
    if (!state) {
        state = subset[mapMask.LO]
              = new SolveThis.Solver.State(mapMask, null, -1);
    }
    return state;
}
function initStates() {
    getState._allStates = {};
}

// =========================================
// Built-in Maps for demo purpose
// =========================================
SolveThis.Map.Simplest = new SolveThis.Map([
    '...     ',
    '...     ',
    '...     ',
    '  XXXX  ',
    '  XXXX  ',
    '     ___',
    '     ___',
    '     ___'
]);

SolveThis.Map.PREDEFINED = [];
SolveThis.Map.PREDEFINED.push(new SolveThis.Map([
    '....    ',
    '.  .  X ',
    '.  .    ',
    '    X   ',
    '     ___',
    '  X    _',
    '       _',
    'X    ___'
]));
SolveThis.Map.PREDEFINED.push(new SolveThis.Map([
    '   X X  ',
    '  X___X ',
    ' X.___.X',
    'X .___. ',
    '  .....X',
    'X     X ',
    ' X   X  ',
    '  X X   '
]));
SolveThis.Map.PREDEFINED.push(new SolveThis.Map([
    '      _ ',
    '   X _ _',
    '  X X _ ',
    '   X    ',
    '    X   ',
    ' . X X  ',
    '. . X   ',
    ' .      '
]));
SolveThis.Map.PREDEFINED.push(new SolveThis.Map([
    'XX    XX',
    'X ___  X',
    '    _   ',
    '    _   ',
    '    ___ ',
    '        ',
    'X .... X',
    'XX....XX'
]));
SolveThis.Map.PREDEFINED.push(new SolveThis.Map([
    '        ',
    ' X    X ',
    '______  ',
    '______  ',
    '__XX..X ',
    '__XX..  ',
    '......  ',
    '......  '
]));
SolveThis.Map.PREDEFINED.push(new SolveThis.Map([
    'X______X',
    ' ______ ',
    ' _    _ ',
    '  X  X  ',
    '        ',
    '   ..   ',
    ' ...... ',
    'X......X'
]));
// TODO: An difficult one.
// SolveThis.Map.PREDEFINED.push(new SolveThis.Map([
//     '  XXX  X',
//     '  __   X',
//     ' X__ XXX',
//     ' X__  ..',
//     ' X__X ..',
//     ' X__X ..',
//     ' XXXX ..',
//     '      ..'
// ]));
// TODO: This one is really difficult.
// Better strategy is required to automatically find the optimal solution.
//
// SolveThis.Map.PREDEFINED.push(new SolveThis.Map([
//     'X .... X',
//     '        ',
//     '. ____ .',
//     '  X__X  ',
//     '. ____ .',
//     '. ____ .',
//     '        ',
//     'X .... X'
// ]));
SolveThis.Map.DEFAULT = SolveThis.Map.Simplest;
})(window);
