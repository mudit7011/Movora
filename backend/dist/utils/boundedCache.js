"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheSet = cacheSet;
// Insert into a Map with a hard size cap. When full, evicts the oldest entry
// (FIFO by insertion order). Prevents unbounded in-memory caches from growing
// until the Node heap is exhausted (a crawler hitting many unique keys would
// otherwise OOM the process).
function cacheSet(map, key, value, max) {
    // Re-inserting an existing key: drop it first so size accounting stays correct.
    if (map.has(key))
        map.delete(key);
    map.set(key, value);
    while (map.size > max) {
        const oldest = map.keys().next().value;
        if (oldest === undefined)
            break;
        map.delete(oldest);
    }
}
