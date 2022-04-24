import { useEffect, useState } from "react"
import { BehaviorSubject, Subscription } from "rxjs"

export type StoreCallbacks<T> = {
	beforeUpdate?: (state: T) => void
	afterUpdate?: (state: T) => void
}

export class Store<T> {
	private _store: BehaviorSubject<T>
	private _callbacks: StoreCallbacks<T> = {}

	constructor(initialValue: T, callbacks: StoreCallbacks<T>) {
		this._store = new BehaviorSubject<T>(initialValue)
		this._callbacks = callbacks
	}

	private compareObjects(o1: any, o2: any): boolean {
		for (var p in o1) {
			if (o1.hasOwnProperty(p)) {
				if (o1[p] !== o2[p]) {
					return false
				}
			}
		}
		for (var p in o2) {
			if (o2.hasOwnProperty(p)) {
				if (o1[p] !== o2[p]) {
					return false
				}
			}
		}
		return true
	}

	currentValue(): T {
		return this._store.value
	}

	set(newValue: T, doForce: boolean = false): void {
		// Before update
		if (this._callbacks.beforeUpdate) {
			this._callbacks.beforeUpdate(this._store.value)
		}
		// Update value
		let areTheySame: boolean = true
		if (!doForce)
			if (newValue instanceof Object) {
				areTheySame = this.compareObjects(this._store.value, newValue)
			} else {
				areTheySame = this._store.value === newValue
			}
		if (!areTheySame) this._store.next((newValue as any).valueOf())
		// After update
		if (this._callbacks.afterUpdate) {
			this._callbacks.afterUpdate(this._store.value)
		}
	}

	merge(newValue: Partial<T>): void {
		this.set({ ...this._store.value, ...newValue })
	}

	subscribe(callback: (state: T) => void): Subscription {
		return this._store.subscribe(callback)
	}

	unsubscribe() {
		this._store.unsubscribe()
	}
}

export function makeStore<T>(
	intialValue: T,
	callbacks?: StoreCallbacks<T>
): [Store<T>, () => [T]] {
	const store = new Store<T>(intialValue, callbacks ? callbacks : {})

	const hook = (): [T] => {
		const [state, setState] = useState(store.currentValue())
		useEffect(() => {
			const subscription = store.subscribe((state: T) => {
				setState(state)
			})
			return () => {
				subscription.unsubscribe()
			}
		})
		return [state]
	}
	return [store, hook]
}
