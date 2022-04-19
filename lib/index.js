import { useEffect, useState } from "react";
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
        if (typeof newValue == "object")
            this._store.next(Object.assign({}, newValue));
        else
            this._store.next(newValue);
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
export function makeStore(intialValue, callbacks) {
    const store = new Store(intialValue, callbacks ? callbacks : {});
    const hook = () => {
        const [state, setState] = useState(store.currentValue());
        useEffect(() => {
            const subscription = store.subscribe((state) => {
                setState(state);
            });
            return () => {
                subscription.unsubscribe();
            };
        });
        return [state];
    };
    return [store, hook];
}
