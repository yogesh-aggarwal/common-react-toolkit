import * as React from "react"
import isEqual from "react-fast-compare"
import { DependencyList, useEffect, useState } from "react"
import { BehaviorSubject, Subscription } from "rxjs"

export namespace CRT {
	export enum Storage {
		// IndexedDB = "indexedDB",
		LocalStorage = "localStorage",
		SessionStorage = "sessionStorage",
	}

	type Config_t = {
		storage: Storage
		selfRecovery: boolean
		storeIDMapper: (storeID: string) => string
	}

	export let CONFIG: Config_t = {
		selfRecovery: false,
		storage: Storage.LocalStorage,
		storeIDMapper: (storeID) => storeID,
	}

	export function Config(config: Partial<Config_t>) {
		CONFIG = { ...CONFIG, ...config }
	}
}

namespace Storage {
	export function getItem(key: string): any {
		if (CRT.CONFIG.storage === CRT.Storage.LocalStorage) {
			const value = localStorage.getItem(key)
			return value ? JSON.parse(value) : null
		} else if (CRT.CONFIG.storage === CRT.Storage.SessionStorage) {
			const value = sessionStorage.getItem(key)
			return value ? JSON.parse(value) : null
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

// prettier-ignore
type StoreHook<T> = <RT=T,>(
	mapper?: (state: T) => RT,
	dependencies?: DependencyList
) => RT

export type StoreCallbacks_t<T> = {
	beforeUpdate?: (newState: T, prevState: T) => any | Promise<any>
	afterUpdate?: (newState: T, prevState: T) => void | Promise<void>
}

export type StoreConfig_t = {
	local: boolean
	storeID: string
}

export class Store<T> {
	private _store: BehaviorSubject<T>
	private _callbacks: StoreCallbacks_t<T> = {}
	private _storeID?: string

	constructor(
		initialValue: T,
		callbacks: StoreCallbacks_t<T>,
		storeID?: string
	) {
		let value: T = initialValue
		if (storeID) {
			const localValue = Storage.getItem(storeID)
			if (localValue) value = localValue
		}
		this._store = new BehaviorSubject<T>(value)
		this._callbacks = callbacks
		if (storeID) this._storeID = CRT.CONFIG.storeIDMapper(storeID)
	}

	currentValue(copy?: boolean): T {
		if (copy) return structuredClone(this._store.value)
		return this._store.value
	}

	async set(newValue: T): Promise<void> {
		if (newValue === undefined) newValue = null as any

		// Before update
		const preventUpdate = await this._callbacks.beforeUpdate?.(
			newValue,
			this._store.value
		)
		if (preventUpdate) return
		// Update value
		if (!newValue) {
			this._store.next(newValue)
		} else {
			this._store.next((newValue as any).valueOf())
		}
		if (this._storeID) {
			Storage.setItem(this._storeID, this._store.value)
		}
		// After update
		await this._callbacks.afterUpdate?.(newValue, this._store.value)
	}

	merge(newValue: Partial<T>): void {
		const mergedValue = { ...this._store.value, ...newValue }
		if (!isEqual(mergedValue, this._store.value)) this.set(mergedValue)
	}

	subscribe(callback: (state: T) => void): Subscription {
		return this._store.subscribe(callback)
	}

	unsubscribe() {
		this._store.unsubscribe()
	}
}

export function onMount(callback: () => void | Promise<void>) {
	useEffect(() => {
		setTimeout(async () => {
			await callback()
		}, 0)
	}, [])
}

export function onUpdate(
	callback: () => void | Promise<void>,
	dependencies: DependencyList
) {
	useEffect(() => {
		setTimeout(async () => {
			await callback()
		}, 0)
	}, dependencies)
}

export function onUnmount(callback: () => void | Promise<void>) {
	useEffect(() => {
		return () => {
			setTimeout(async () => {
				await callback()
			}, 0)
		}
	}, [])
}

export function onLifecycle(events: {
	onMount: () => Promise<void>
	onUnmount: () => Promise<void>
	onUpdate?: { callback: () => Promise<void>; dependencies: DependencyList }
}): void {
	onMount(events.onMount)
	onUnmount(events.onUnmount)
	if (events.onUpdate)
		onUpdate(events.onUpdate.callback, events.onUpdate.dependencies)
}

export function useBindEvent<T = Event>(
	event: string,
	handler: (e: T) => void,
	passive?: boolean
) {
	useEffect(() => {
		window.addEventListener(event, handler as any, { passive: passive })
		return () => window.removeEventListener(event, handler as any)
	}, [event, handler, passive])
}

export function useBoundValue<T>(mapper: () => T, stores: Store<any>[]): T {
	const [value, setValue] = useState(mapper())
	useEffect(() => {
		const subscriptions = stores.map((dependency) =>
			dependency.subscribe(() => setValue(mapper()))
		)
		return () => {
			subscriptions.forEach((subscription) => subscription.unsubscribe())
		}
	}, [])

	return value
}

export function makeStore<T>(
	intialValue: T,
	callbacks?: StoreCallbacks_t<T>,
	config?: Partial<StoreConfig_t>
): [Store<T>, StoreHook<T>] {
	const store = new Store<T>(
		intialValue,
		callbacks ? callbacks : {},
		config?.storeID
	)

	// prettier-ignore
	const hook = <RT=T,>(
		mapper?: (state: T) => RT,
		dependencies?: DependencyList
	): RT => {
		const initialValue = mapper ? mapper(store.currentValue()) : store.currentValue()
		const [state, setState] = useState<RT>(initialValue as any)
		if (config?.local) onUnmount(() => store.set(intialValue))

		useEffect(() => {
			const subscription = store.subscribe((newState: T) => {
				// If filter is defined, only update state if two states are not equal
				newState = mapper
					? mapper(store.currentValue())
					: (store.currentValue() as any)

				if (isEqual(state, newState)) return
				setState(newState as any)
			})
			return () => {
				subscription.unsubscribe()
			}
		})

		if (mapper && dependencies)
			useEffect(() => {
				setState(mapper(store.currentValue()) as any)
			}, dependencies)

		return state
	}

	return [store, hook]
}

export function makeBoundStore<T>(
	initialValue: T,
	valueMapper: () => T,
	stores: Store<any>[],
	callbacks?: StoreCallbacks_t<T>,
	options?: {
		local?: boolean
		storeID?: string
	}
): [Store<T>, StoreHook<T>] {
	const [store] = makeStore<T>(initialValue, callbacks, options)

	// prettier-ignore
	const hook = <RT=T,>(
		mapper?: (state: T) => RT,
		dependencies?: DependencyList
	): RT => {
		const [state, setState] = useState<RT>(
			mapper ? mapper(valueMapper()) : (valueMapper() as any)
		)
		useEffect(() => {
			const subscriptions = stores.map((dependency) =>
				dependency.subscribe(() =>
					setState(mapper ? mapper(valueMapper()) : (valueMapper() as any))
				)
			)
			return () => {
				subscriptions.forEach((subscription) => subscription.unsubscribe())
			}
		}, [])

		if (mapper && dependencies)
			useEffect(() => {
				setState(mapper(store.currentValue()) as any)
			}, dependencies)

		return state
	}

	return [store, hook]
}

export function BindCallback(
	callback: () => any | Promise<void>,
	stores: Store<any>[]
) {
	for (const store of stores) store.subscribe(callback)
}

export function If(props: {
	value: any
	children: React.ReactNode
}): React.ReactElement {
	if (props.value) return <>{props.children}</>
	return <></>
}
