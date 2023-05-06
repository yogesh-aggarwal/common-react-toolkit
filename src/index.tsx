import { DependencyList, RefObject, useEffect, useMemo, useState } from "react"
import isEqual from "react-fast-compare"
import { BehaviorSubject, Subscription, combineLatest } from "rxjs"

export namespace CRT {
	export enum Storage {
		LocalStorage = "localStorage",
		SessionStorage = "sessionStorage",
	}

	type Config_t = {
		application: string
		dbVersion: number

		storage: Storage
		selfRecovery: boolean
		onJSONParseError?: () => any
		storeIDMapper: (storeID: string) => string
	}

	export let CONFIG: Config_t = {
		selfRecovery: false,
		application: "CRT",
		dbVersion: 1,

		storage: Storage.LocalStorage,
		storeIDMapper: (storeID) => storeID,
	}

	export function Clear() {
		if (CONFIG.storage === Storage.LocalStorage) {
			localStorage.clear()
		} else if (CONFIG.storage === Storage.SessionStorage) {
			sessionStorage.clear()
		}
	}

	export function Config(config: Partial<Config_t>) {
		CONFIG = { ...CONFIG, ...config }
	}
}

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
	noCache: boolean
}

export class Store<T> {
	private _store: BehaviorSubject<T>
	private _callbacks: StoreCallbacks_t<T> = {}
	private _storeID?: string
	private _noCache?: boolean

	get storeID() {
		return this._storeID
	}
	get store() {
		return this._store
	}

	constructor(
		initialValue: T,
		callbacks: StoreCallbacks_t<T>,
		storeID?: string,
		noCache?: boolean
	) {
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
	}

	private _prepareStoreID(storeID: string): string {
		return `[${CRT.CONFIG.application}.v${
			CRT.CONFIG.dbVersion
		}] ${CRT.CONFIG.storeIDMapper(storeID)}`
	}

	currentValue(): T {
		const value = this._store.value
		try {
			return structuredClone(value)
		} catch (e) {
			return value
		}
	}

	async set(newValue: T): Promise<void> {
		if (newValue === undefined) newValue = null as any
		if (isEqual(newValue, this._store.value)) return

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
		if (this._storeID && !this._noCache) {
			Storage.setItem(this._storeID!, this._store.value)
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

export function onMount(callback: () => any) {
	useEffect(() => {
		callback()
	}, [])
}

export function onUpdate(callback: () => any, dependencies: DependencyList) {
	useEffect(() => {
		callback()
	}, dependencies)
}

export function onUnmount(callback: () => any) {
	useEffect(() => {
		return () => {
			callback()
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
	config: {
		passive?: boolean
		capture?: boolean
		once?: boolean
		signal?: AbortSignal
		ref?: RefObject<HTMLElement>
	} = {}
) {
	useEffect(() => {
		if (config.ref) {
			const element = config.ref.current
			if (element) {
				element.addEventListener(event, handler as any, {
					passive: config.passive,
					capture: config.capture,
					once: config.once,
					signal: config.signal,
				})
				return () => element.removeEventListener(event, handler as any)
			}
		} else {
			window.addEventListener(event, handler as any, {
				passive: config.passive,
				capture: config.capture,
				once: config.once,
				signal: config.signal,
			})
			return () => window.removeEventListener(event, handler as any)
		}
	}, [event, handler, config])
}

export function useBoundValue<T>(mapper: () => T, stores: Store<any>[]): T {
	const initialValue = useMemo(() => mapper(), [])
	const [value, setValue] = useState(initialValue)

	const [subscription, setSubscription] = useState<Subscription | null>(null)
	onMount(() => {
		setSubscription(
			combineLatest(stores.map((store) => store.store)).subscribe(() => {
				setValue(mapper())
			})
		)
	})
	onUnmount(() => subscription?.unsubscribe())

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
		config?.storeID,
		config?.noCache
	)

	// prettier-ignore
	const hook = <RT=T,>(
		mapper: (state: T) => RT = (x) => x as any,
		dependencies?: DependencyList
	): RT => {
      const value = useMemo(() => mapper(store.currentValue()), [])
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
	options?: Partial<StoreConfig_t>
): [Store<T>, StoreHook<T>] {
	const [store] = makeStore<T>(initialValue, callbacks, options)

	// prettier-ignore
	const hook = <RT=T,>(
		mapper: (state: T) => RT = (x) => x as any,
		dependencies?: DependencyList
	): RT => {
      const value = useMemo(() => mapper(valueMapper()), [])
		const [state, setState] = useState<RT>(value)

		const [subscription, setSubscription] = useState<Subscription | null>(null)
		onMount(() => {
			setSubscription(
				combineLatest(stores.map((store) => store.store)).subscribe(() => {
					const newState = mapper(valueMapper())
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
