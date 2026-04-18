// Global singleton — only one preview active at a time across the entire app.
// Any component can call start(id, stopFn) and the manager guarantees
// the previous preview is stopped before the new one begins.

let _currentId = null;
let _stopFn    = null;
const _subs    = new Set();

const previewManager = {
  get current() { return _currentId; },

  // Start preview for `id`. Stops the current one first.
  start(id, stopFn) {
    if (_currentId === id) return;
    _stopFn?.();
    _currentId = id;
    _stopFn    = stopFn;
    _subs.forEach(fn => fn(id));
  },

  // Stop preview for `id` (no-op if something else is active).
  stop(id) {
    if (_currentId !== id) return;
    _stopFn?.();
    _currentId = null;
    _stopFn    = null;
    _subs.forEach(fn => fn(null));
  },

  // Subscribe to active-id changes. Returns unsubscribe fn.
  subscribe(fn) {
    _subs.add(fn);
    return () => _subs.delete(fn);
  },
};

export default previewManager;
