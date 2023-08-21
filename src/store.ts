import { DependencyList, useEffect, useMemo, useState } from "react"
import isEqual from "react-fast-compare"
import { BehaviorSubject, Subscription } from "rxjs"
import { BasicStore } from "./basicStore"
import { CRT } from "./common"
import { onMount, onUnmount } from "./hooks"
import { StorageStoreCallbacks_t, StorageStoreConfig_t, StoreHook } from "./idb"

namespace Storage {
	export function getItem(key: string): any {
		if (
			[CRT.Storage.LocalStorage, CRT.Storage.SessionStorage].includes(
				CRT.CONFIG.storage
			)
		) {
			let value: any = null
			if (CRT.CONFIG.storage === CRT.Storage.LocalStorage)
				value = localStorage.getItem(key)
			else value = sessionStorage.getItem(key)

			if (!value) return null

			try {
				return JSON.parse(value)
			} catch (e) {
				const preventRecovery = CRT.CONFIG.onJSONParseError?.()
				if (!preventRecovery && CRT.CONFIG.selfRecovery) {
					localStorage.removeItem(key)
					sessionStorage.removeItem(key)
				}
				return null
			}
		}
		return null
	}

	export function setItem(key: string, value: any) {
		if (CRT.CONFIG.storage === CRT.Storage.LocalStorage) {
			localStorage.setItem(key, JSON.stringify(value))
		} else if (CRT.CONFIG.storage === CRT.Storage.SessionStorage) {
			sessionStorage.setItem(key, JSON.stringify(value))
		}
	}
}

export class Store<T> extends BasicStore<T> {
	protected _store: BehaviorSubject<T>
	private _callbacks: StorageStoreCallbacks_t<T> = {}
	private _storeID?: string
	private _noCache?: boolean
	private _disableComparison?: boolean

	get storeID() {
		return this._storeID
	}
	get store() {
		return this._store
	}

	constructor(
		initialValue: T,
		callbacks: StorageStoreCallbacks_t<T>,
		storeID?: string,
		noCache?: boolean,
		disableComparison?: boolean
	) {
		super()
		let value: T = initialValue
		if (storeID) {
			this._storeID = this._prepareStoreID(storeID)
			if (!noCache) {
				const localValue = Storage.getItem(this._storeID)
				if (localValue) value = localValue
			}
		}
		this._store = new BehaviorSubject<T>(value)
		this._callbacks = callbacks
		this._noCache = noCache
		this._disableComparison = disableComparison
	}

	async set(newValue: T): Promise<void> {
		if (newValue === undefined) newValue = null as any
		if (!this._disableComparison && isEqual(newValue, this._store.value)) return

		let prevValue = this._store.value
		try {
			prevValue = structuredClone(this._store.value)
		} catch {
			prevValue = this._store.value
		}

		// Before update
		const preventUpdate = await this._callbacks.beforeUpdate?.(
			newValue,
			prevValue
		)
		if (preventUpdate) return
		// Update value
		if (!newValue) {
			this._store.next(newValue)
		} else {
			this._store.next((newValue as any).valueOf())
		}
		if (this._storeID && !this._noCache) {
			Storage.setItem(this._storeID!, this._store.value)
		}
		// After update
		await this._callbacks.afterUpdate?.(newValue, prevValue)
	}

	merge(newValue: Partial<T>): void {
		const mergedValue = { ...this._store.value, ...newValue }
		if (!isEqual(mergedValue, this._store.value)) this.set(mergedValue)
	}
}

export function makeStore<T>(
	initialValue: T,
	callbacks?: StorageStoreCallbacks_t<T>,
	config?: Partial<StorageStoreConfig_t>
): [Store<T>, StoreHook<T>] {
	const store = new Store<T>(
		initialValue,
		callbacks ? callbacks : {},
		config?.storeID,
		config?.noCache,
		config?.disableComparison
	)

	// prettier-ignore
	const hook = <RT=T,>(
		mapper: (state: T) => RT = (x) => x as any,
		dependencies?: DependencyList
	): RT => {
      const value = useMemo(() => mapper(store.value()), [])
		const [state, setState] = useState<RT>(value)
      if (config?.local) onUnmount(() => store.set(initialValue))

		const [subscription, setSubscription] = useState<Subscription | null>(null)      
		onMount(() => {
			setSubscription(
				store.subscribe((newState: T) => {
					newState = mapper(newState) as any
					setState((prevState: any) => {
						if (isEqual(prevState, newState)) return prevState
						return newState
					})
				})
			)
		})
		onUnmount(() => subscription?.unsubscribe())

		if (mapper && dependencies)
			useEffect(() => {
				setState(mapper(store.value()) as any)
			}, dependencies)

		return state
	}

	return [store, hook]
}
