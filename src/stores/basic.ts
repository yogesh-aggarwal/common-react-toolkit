import { BehaviorSubject, Subscription } from "rxjs"
import { CRT } from "../core/common"

export abstract class BasicStore<T> {
	protected abstract _store: BehaviorSubject<T>

	get store() {
		return this._store
	}

	value(): T {
		return Object.freeze(this._store.value)
	}

	/**
	 * @deprecated
	 */
	currentValue(): T {
		return this.value()
	}

	subscribe(callback: (state: T) => void): Subscription {
		return this._store.subscribe(callback)
	}

	unsubscribe() {
		this._store.unsubscribe()
	}

	protected _prepareStoreID(storeID: string): string {
		return `[${CRT.CONFIG.application}.v${
			CRT.CONFIG.dbVersion
		}] ${CRT.CONFIG.storeIDMapper(storeID)}`
	}
}
