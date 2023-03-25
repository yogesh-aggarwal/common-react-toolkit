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

		dbVersion: number
		application: string

		selfRecovery: boolean
		errorCallback: () => any
		storeIDMapper: (storeID: string) => string
	}

	export let CONFIG: Config_t = {
		storage: Storage.LocalStorage,

		dbVersion: 1,
		application: "CRT",

		selfRecovery: false,
		errorCallback: () => {},
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
		this._callbacks = callbacks

		let value: T = initialValue
		if (storeID) {
			this.__prepareStoreID__(storeID)
			const localValue = Storage.getItem(this._storeID!)
			if (localValue) value = localValue
		}
		this._store = new BehaviorSubject<T>(value)
	}

	private __prepareStoreID__(storeID: string) {
		this._storeID = `${CRT.CONFIG.application}.v${
			CRT.CONFIG.dbVersion
		}.${CRT.CONFIG.storeIDMapper(storeID)}`
	}

	currentValue(copy?: boolean): T {
		if (copy) return structuredClone(this._store.value)
		return this._store.value
	}

	async set(newValue: T, noCompare?: boolean): Promise<void> {
		if (newValue === undefined) newValue = null as any
		if (isEqual(newValue, this._store.value) && !noCompare) return

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

	merge(newValue: Partial<T>, noCompare?: boolean): void {
		const mergedValue = { ...this._store.value, ...newValue }
		this.set(mergedValue, noCompare)
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

export function useBindEvent<T = Event, El = HTMLElement>(
	event: string,
	handler: (e: T) => void,
	config: {
		passive?: boolean
		once?: boolean
		capture?: boolean
		signal?: AbortSignal
		ref?: React.RefObject<El>
		id?: string
	} = {}
) {
	if (config.id && config.ref) {
		throw new Error(
			`[CRT] You are using both id and ref in useBindEvent which are not allowed as per the specification. Please use only one of them or refer to docs at https://yogeshaggarwal.gitbook.io/common-react-toolkit/ for more info.`
		)
	}
	useEffect(() => {
		if (config.id) {
			const el = document.getElementById(config.id)
			if (!el) return
			el.addEventListener(event, handler as any, { ...config })
			return () => el.removeEventListener(event, handler as any)
		} else if (config.ref && config.ref.current) {
			;(config.ref.current as any).addEventListener(event, handler as any, {
				...config,
			})
			return () =>
				config.ref &&
				(config.ref.current as any).removeEventListener(event, handler as any)
		}
		window.addEventListener(event, handler as any, { ...config })
		return () => window.removeEventListener(event, handler as any)
	}, [event, handler, config])
}

export function useBoundValue<T>(mapper: () => T, stores: Store<any>[]): T {
	const [value, setValue] = useState(mapper())
	const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
	onMount(() => {
		setSubscriptions(
			stores.map((dependency) => dependency.subscribe(() => setValue(mapper())))
		)
	})
	onUnmount(() => {
		subscriptions.forEach((subscription) => subscription.unsubscribe())
	})
	return value
}

export function makeStore<T>(
	initialValue: T,
	callbacks?: StoreCallbacks_t<T>,
	config?: Partial<StoreConfig_t>
): [Store<T>, StoreHook<T>] {
	const store = new Store<T>(
		initialValue,
		callbacks ? callbacks : {},
		config?.storeID
	)

	// prettier-ignore
	const hook = <RT=T,>(
		mapper?: (state: T) => RT,
		dependencies?: DependencyList
	): RT => {
		const initialValue = store.currentValue()
		const [state, setState] = useState<RT>(
			mapper ? mapper(initialValue) : (initialValue as any)
		)
		if (config?.local) onUnmount(() => store.set(initialValue))

		useEffect(() => {
			const subscription = store.subscribe((newState: T) => {
				// If filter is defined
				newState = mapper ? mapper(newState) : (newState as any)
				// Only update state if two states are not equal
				if (!isEqual(state, newState)) setState(newState as any)
			})
			return () => subscription.unsubscribe()
		}, [])

		if (mapper && dependencies)
			onUpdate(() => {
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
	config?: {
		local?: boolean
		storeID?: string
	}
): [Store<T>, StoreHook<T>] {
	const [store] = makeStore<T>(initialValue, callbacks, config)

	// prettier-ignore
	const hook = <RT=T,>(
		mapper?: (state: T) => RT,
		dependencies?: DependencyList
	): RT => {
		const initialValue = valueMapper()
		const [state, setState] = useState<RT>(
			mapper ? mapper(initialValue) : (initialValue as any)
		)
		if (config?.local) onUnmount(() => store.set(initialValue))

		useEffect(() => {
			const subscriptions = stores.map((dependency) =>
				dependency.subscribe(() => {
					const value = valueMapper()
					setState(mapper ? mapper(value) : (value as any))
				})
			)
			return () =>
				subscriptions.forEach((subscription) => subscription.unsubscribe())
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
}): React.ReactElement | null {
	if (props.value) return <>{props.children}</>
	return null
}
