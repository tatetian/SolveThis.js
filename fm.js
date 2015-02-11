// =======================================================
// FM - Functional Math
// This module provides utility functions to do math
// in a functional fashion
// =======================================================
(function(parentModule, _) {
if (parentModule.FM) return;
var FM = parentModule.FM = {};

var isArray = _.isArray;
var isFunc = _.isFunction;
var isIterable = function(obj) {
    return obj && isFunc(obj.next);
}

// =======================================================
//  Interface
// =======================================================
FM.iterable = function(iter) {
    if (isIterable(iter)) return iter;
    if (isArray(iter)) return new ArrayIterator(iter);
    return null;
}
FM.array = function(iter) {
    if (isArray(iter)) return iter;
    if (!isIterable(iter)) return null;

    var array = new Array();
    var ele;
    while ((ele = iter.next()) != undefined) array.push(ele);
    return array;
}
FM.range = function(begin, end) {
    return new RangeIterator(begin, end);
}
FM.permutation = function(iter, k) {
    return new PermutationIterator(iter, k);
}
FM.crossjoin = FM.cartesianProduct = function(iter, func) {
    return new CartesianProductIterator(iter, func);
}
FM.min = function(iter, func) {
    var iter = FM.iterable(iter);
    var min = Infinity;
    var val;
    while ((val = iter.next()) != undefined) {
        if (func) val = func(val);
        if (val < min) min = val;
    }
    return min;
}
FM.max = function(iter, func) {
    var iter = FM.iterable(iter);
    var max = -Infinity;
    var val;
    while ((val = iter.next()) != undefined) {
        if (func) val = func(val);
        if (val > max) max = val;
    }
    return max;
}
FM.sum = function(iter, func) {
    var iter = FM.iterable(iter);
    var sum = 0;
    var val;
    while ((val = iter.next()) != undefined) {
        if (func) val = func(val);
        sum += val;
    }
    return sum;
}


// =======================================================
//  Private Classes
// =======================================================
var ArrayIterator = function(array) {
    this._array = array;
    this._i = 0;
}
ArrayIterator.prototype.next = function() {
    if (this._i >= this._array.length) return undefined;
    return this._array[this._i++];
}

var RangeIterator = function(begin, end) {
    if (end == undefined) {
        end = begin;
        begin = 0;
    }
    if (begin > end) end = begin;
    this._i = begin;
    this._end = end;
}
RangeIterator.prototype.next = function() {
    if (this._i >= this._end) return undefined;
    return this._i++;
}

// Permutation in lexicological order
var PermutationIterator = function(iter, k) {
    var items = this._items = FM.array(iter);
    var n = this._n = items.length;
    var used = this._used = new Array(n);
    for (var ui = 0; ui < n; ui++) used[ui] = false;

    // initialize the perm to an 'impossible' state, the next permutation of
    // which, according to the algorithm, is the first valid permutation
    var perm = this._perm = new Array(k);
    for (var pi = 1; pi < k; pi++) perm[pi] = n-1;
    perm[0] = -1;

    this._k = k;
    this._terminated = k <= 0 || k > n;
}
PermutationIterator.prototype.next = function() {
    if (this._terminated) return undefined;

    var items = this._items;
    var n = this._n;
    var k = this._k;
    var used = this._used;
    var perm = this._perm;

    // find the right-most position can be increased
    var pos = k - 1;
    var nextItem;
    while (pos >= 0) {
        // can this position be increased
        var preItem = perm[pos];
        used[preItem] = false;

        nextItem = preItem + 1;
        while (nextItem < n && used[nextItem]) nextItem++;
        if (nextItem < n) break;

        pos--;
    }

    // terminate
    if (pos < 0) { this._terminated = true; return undefined; }

    // update this position
    perm[pos] = nextItem;
    used[nextItem] = true;

    // fill the positions to the right
    pos += 1;
    for (var itemPos = 0; pos < k; pos++, itemPos++) {
        while (used[itemPos]) itemPos++;
        perm[pos] = itemPos;
        used[itemPos] = true;
    }

    // permutation represented in items
    var res = new Array(k);
    for (var ri = 0; ri < k; ri++) res[ri] = items[perm[ri]];
    return res;
}

var CartesianProductIterator = function(iterOfIter, func) {
    var sets = this._sets = FM.array(iterOfIter);
    console.log(sets);
    for (var si in sets) {
        sets[si] = FM.array(func ? func(sets[si]) : sets[si]);
    }
    console.log(sets);
    var lens = this._lens = _.map(sets, function(set) { return set.length; });
    var k = this._k = sets.length;

    // initialize the combination to an invalid state so that the next of it
    // is the first valid combination
    var comb = this._comb = new Array(k);
    for (var i = 1; i < k; i++) comb[i] = lens[i] - 1;
    comb[0] = -1;

    this._terminated = false;
}
CartesianProductIterator.prototype.next = function() {
    if (this._terminated) return;

    var sets = this._sets;
    var lens = this._lens;
    var k = this._k;
    var comb = this._comb;

    // find the right-most position that can be increased
    var pos = k - 1;
    while (pos >= 0 && comb[pos] + 1 >= lens[pos]) pos--;

    // terminate
    if (pos < 0) { this._terminated = true; return undefined; }

    // udpate the position
    comb[pos]++;

    // fill the positions to the right
    pos += 1;
    while (pos < k) comb[pos++] = 0;

    var res = new Array(k);
    for (var i = 0; i < k; i++) res[i] = sets[i][comb[i]];
    return res;
}
})(window, _); // Assume Underscore.js exists
