import { Store, StoreCallbacks } from "./store";
export declare function makeStore<T>(intialValue: T, callbacks?: StoreCallbacks<T>): [Store<T>, () => [T]];
