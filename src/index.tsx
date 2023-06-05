import { DependencyList, RefObject, useEffect, useMemo, useState } from "react"
import isEqual from "react-fast-compare"
import { BehaviorSubject, Subscription, combineLatest } from "rxjs"

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

	protected _prepareStoreID(storeID: string): string {
		return `[${CRT.CONFIG.application}.v${
			CRT.CONFIG.dbVersion
		}] ${CRT.CONFIG.storeIDMapper(storeID)}`
	}
}

export namespace CRT {
	export enum Storage {
		LocalStorage,
		SessionStorage,
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

type IDBStoreValue_t<T> = { [key: string]: T }
export type IDBStoreCallbacks_t<T> = {
	afterUpdate?: (
		newState: IDBStoreValue_t<T>,
		prevState: IDBStoreValue_t<T>
	) => any | Promise<any>
	onDBCreateSuccess?: (db: IDBDatabase) => void | Promise<void>
	onDBCreateFail?: () => void | Promise<void>
}

export type StorageStoreCallbacks_t<T> = {
	beforeUpdate?: (newState: T, prevState: T) => any | Promise<any>
	afterUpdate?: (newState: T, prevState: T) => void | Promise<void>
}
export type StorageStoreConfig_t = {
	local: boolean
	storeID: string
	noCache: boolean
}

// prettier-ignore
export type StoreHook<T> = <RT=T,>(
	mapper?: (state: T) => RT,
	dependencies?: DependencyList
) => RT

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
		noCache?: boolean
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
	callbacks?: StorageStoreCallbacks_t<T>,
	options?: Partial<StorageStoreConfig_t>
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

export class IDBCollectionStore<T = any> extends BasicStore<
	IDBStoreValue_t<T>
> {
	private _key: string
	private _name: string
	private _version: number
	private _db: IDBDatabase | null = null
	private _callbacks: IDBStoreCallbacks_t<T> = {}
	protected _store: BehaviorSubject<IDBStoreValue_t<T>> = new BehaviorSubject(
		{}
	)

	constructor(
		name: string,
		key: string,
		version: number,
		callbacks: IDBStoreCallbacks_t<T>
	) {
		super()

		this._key = key
		this._name = this._prepareStoreID(name)
		this._version = version
		this._callbacks = callbacks

		const request = indexedDB.open(this._name, this._version)
		request.onupgradeneeded = (idbEvent) => {
			const db = (idbEvent.target as any).result as IDBDatabase
			if (db.objectStoreNames.contains(this._name)) db.deleteObjectStore(this._name)
			const objectStore = db.createObjectStore(this._name, { keyPath: key })
			objectStore.createIndex(key, key, { unique: true })
			callbacks.onDBCreateSuccess?.(db)
		}
		request.onsuccess = (idbEvent) => {
			this._db = (idbEvent.target as any).result as IDBDatabase
			const transaction = this._db.transaction(this._name, "readonly")
			const objectStore = transaction.objectStore(this._name)

			const request = objectStore.getAll()
			request.onerror = () => {
				callbacks.onDBCreateFail?.()
			}
			request.onsuccess = () => {
				callbacks.onDBCreateFail?.()
				const data = request.result.reduce((acc: any, item: any) => {
					acc[item[key]] = item
					return acc
				}, {})
				this._store.next(data)
			}
		}
	}

	private getObjectStore(mode: IDBTransactionMode): IDBObjectStore | undefined {
		const transaction = this._db?.transaction(this._name, mode)
		const objectStore = transaction?.objectStore(this._name)
		return objectStore
	}

	currentValue() {
		return this._store.value
	}

	async Create(data: T, clear?: boolean): Promise<void> {
		this.Update((data as any)[this._key], data, clear)
	}

	async CreateMany(data: T[], clear?: boolean): Promise<void> {
		this.UpdateMany(data, clear)
	}

	async Update(key: string, data: T, clear?: boolean): Promise<void> {
		if (!this._db) {
			console.error(`[CRT] (${this._name}) Database not initialized`)
		}
		const objectStore = this.getObjectStore("readwrite")
		if (!objectStore) return

		const request = objectStore.put(data)
		return new Promise<void>((resolve, reject) => {
			request.onsuccess = async () => {
				const newValue = clear ? {} : this._store.value
				newValue[key] = data
				this._store.next(newValue)
				await this._callbacks.afterUpdate?.(newValue, this._store.value)
				resolve()
			}
			request.onerror = () => {
				console.error(`[CRT] (${this._name}) Error updating data`)
				reject()
			}
		})
	}

	async UpdateMany(data: T[], clear?: boolean): Promise<void> {
		if (!this._db) {
			console.error(`[CRT] (${this._name}) Database not initialized`)
		}

		const tx = this._db?.transaction(this._name, "readwrite")
		if (!tx) return

		return new Promise<void>((resolve, reject) => {
			for (const obj of data) tx.objectStore(this._name).put(obj)
			tx.oncomplete = async () => {
				const newValue = clear ? {} : this._store.value
				for (const obj of data) newValue[(obj as any)[this._key]] = obj
				this._store.next(newValue)
				await this._callbacks.afterUpdate?.(newValue, this._store.value)
				resolve()
			}
			tx.onerror = () => {
				console.error(`[CRT] (${this._name}) Error updating data`)
				reject()
			}
		})
	}

	async Delete(key: string, clear?: boolean) {
		if (!this._db) {
			console.error(`[CRT] (${this._name}) Database not initialized`)
		}

		const objectStore = this.getObjectStore("readwrite")
		if (!objectStore) return

		const request = objectStore.delete(key)
		return new Promise<void>((resolve, reject) => {
			request.onsuccess = async () => {
				const newValue = clear ? {} : { ...this._store.value }
				delete newValue[key]
				this._store.next(newValue)
				await this._callbacks.afterUpdate?.(newValue, this._store.value)
				resolve()
			}
			request.onerror = () => {
				console.error(`[CRT] (${this._name}) Error deleting data`)
				reject()
			}
		})
	}

	async DeleteMany(keys: string[], clear?: boolean) {
		if (!this._db) {
			console.error(`[CRT] (${this._name}) Database not initialized`)
		}

		const tx = this._db?.transaction(this._name, "readwrite")
		if (!tx) return

		return new Promise<void>((resolve, reject) => {
			for (const key of keys) tx.objectStore(this._name).delete(key)
			tx.oncomplete = async () => {
				const newValue = clear ? {} : { ...this._store.value }
				for (const key of keys) delete newValue[key]
				this._store.next(newValue)
				await this._callbacks.afterUpdate?.(newValue, this._store.value)
				resolve()
			}
			tx.onerror = () => {
				console.error(`[CRT] (${this._name}) Error deleting data`)
				reject()
			}
		})
	}

	async Clear() {
		if (!this._db) {
			console.error(`[CRT] (${this._name}) Database not initialized`)
		}

		const objectStore = this.getObjectStore("readwrite")
		if (!objectStore) return

		const request = objectStore.clear()
		return new Promise<void>((resolve, reject) => {
			request.onsuccess = async () => {
				const newValue = {}
				this._store.next(newValue)
				await this._callbacks.afterUpdate?.(newValue, this._store.value)
				resolve()
			}
			request.onerror = () => {
				console.error(`[CRT] (${this._name}) Error clearing data`)
				reject()
			}
		})
	}
}

export function makeIDBDatabaseStore<T>(
	config: { name: string; key: string; version: number },
	callbacks?: IDBStoreCallbacks_t<T>
): [IDBCollectionStore<T>, StoreHook<IDBStoreValue_t<T>>] {
	const store = new IDBCollectionStore<T>(
		config.name,
		config.key,
		config.version,
		callbacks ?? {}
	)

	// prettier-ignore
	const hook = <RT=T,>(
		mapper: (state: IDBStoreValue_t<T>) => RT = (x) => x as any,
		dependencies?: DependencyList
	): RT => {
      const value = useMemo(() => mapper(store.currentValue()), [])
		const [state, setState] = useState<RT>(value)

		const [subscription, setSubscription] = useState<Subscription | null>(null)      
		onMount(() => {
			setSubscription(
				store.subscribe((newState: IDBStoreValue_t<T>) => {
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

export function useBoundValue<T>(
	mapper: () => T,
	stores: (Store<any> | IDBCollectionStore<any>)[]
): T {
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

export function BindCallback(
	callback: () => any | Promise<void>,
	stores: (Store<any> | IDBCollectionStore<any>)[]
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
