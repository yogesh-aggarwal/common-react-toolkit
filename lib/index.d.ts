import { Subscription } from "rxjs";
export declare type StoreCallbacks<T> = {
    beforeUpdate?: (state: T) => void;
    afterUpdate?: (state: T) => void;
};
export declare class Store<T> {
    private _store;
    private _callbacks;
    constructor(initialValue: T, callbacks: StoreCallbacks<T>);
    currentValue(): T;
    set(newValue: T): void;
    merge(newValue: Partial<T>): void;
    subscribe(callback: (state: T) => void): Subscription;
    unsubscribe(): void;
}
export declare function makeStore<T>(intialValue: T, callbacks?: StoreCallbacks<T>): [Store<T>, () => [T]];
