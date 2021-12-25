import { BehaviorSubject, Subscription } from "rxjs";

export type StoreCallbacks<T> = {
	beforeUpdate?: (state: T) => void;
	afterUpdate?: (state: T) => void;
};

export class Store<T> {
	private _store: BehaviorSubject<T>;
	private _callbacks: StoreCallbacks<T> = {};

	constructor(initialValue: T, callbacks: StoreCallbacks<T>) {
		this._store = new BehaviorSubject<T>(initialValue);
		this._store.subscribe((value: T) => {});
		this._callbacks = callbacks;
	}

	currentValue(): T {
		return this._store.value;
	}

	set(newValue: T): void {
		// Before update
		if (this._callbacks.beforeUpdate) {
			this._callbacks.beforeUpdate(this._store.value);
		}
		// Update value
		this._store.next({ ...newValue });
		// After update
		if (this._callbacks.afterUpdate) {
			this._callbacks.afterUpdate(this._store.value);
		}
	}

	subscribe(callback: (state: T) => void): Subscription {
		return this._store.subscribe(callback);
	}

	unsubscribe() {
		this._store.unsubscribe();
	}
}
