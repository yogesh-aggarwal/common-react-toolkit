import { BehaviorSubject } from "rxjs";
export class Store {
    constructor(initialValue, callbacks) {
        this._callbacks = {};
        this._store = new BehaviorSubject(initialValue);
        this._store.subscribe((value) => { });
        this._callbacks = callbacks;
    }
    currentValue() {
        return this._store.value;
    }
    set(newValue) {
        // Before update
        if (this._callbacks.beforeUpdate) {
            this._callbacks.beforeUpdate(this._store.value);
        }
        // Update value
        this._store.next(Object.assign({}, newValue));
        // After update
        if (this._callbacks.afterUpdate) {
            this._callbacks.afterUpdate(this._store.value);
        }
    }
    merge(newValue) {
        this.set(Object.assign(Object.assign({}, this._store.value), newValue));
    }
    subscribe(callback) {
        return this._store.subscribe(callback);
    }
    unsubscribe() {
        this._store.unsubscribe();
    }
}
