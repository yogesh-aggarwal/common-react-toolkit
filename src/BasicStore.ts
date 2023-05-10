import { BehaviorSubject, Subscription } from "rxjs"

export abstract class BasicStore<T> {
	protected abstract _store: BehaviorSubject<T>

	get store() {
		return this._store
	}

	currentValue(): T {
		const value = this._store.value
		try {
			return structuredClone(value)
		} catch (e) {
			return value
		}
	}

	subscribe(callback: (state: T) => void): Subscription {
		return this._store.subscribe(callback)
	}

	unsubscribe() {
		this._store.unsubscribe()
	}
}
