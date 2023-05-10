import { DependencyList, useEffect, useMemo, useState } from "react"
import isEqual from "react-fast-compare"
import { BehaviorSubject, Subscription } from "rxjs"
import { BasicStore } from "./BasicStore"
import { onMount, onUnmount } from "./Hooks"

type StoreValue_t<T> = { [key: string]: T }

export type StoreCallbacks_t<T> = {
	afterUpdate?: (
		newState: StoreValue_t<T>,
		prevState: StoreValue_t<T>
	) => any | Promise<any>
	onDBCreateSuccess?: (db: IDBDatabase) => void | Promise<void>
	onDBCreateFail?: () => void | Promise<void>
}

// prettier-ignore
export type StoreHook<T> = <RT=T,>(
	mapper?: (state: T) => RT,
	dependencies?: DependencyList
) => RT

export class IDBCollectionStore<T = any> extends BasicStore<StoreValue_t<T>> {
	private _key: string
	private _name: string
	private _version: number
	private _db: IDBDatabase | null = null
	private _callbacks: StoreCallbacks_t<T> = {}
	protected _store: BehaviorSubject<StoreValue_t<T>> = new BehaviorSubject({})

	constructor(
		name: string,
		key: string,
		version: number,
		callbacks: StoreCallbacks_t<T>
	) {
		super()

		this._key = key
		this._name = name
		this._version = version
		this._callbacks = callbacks

		const request = indexedDB.open(name, this._version)
		request.onupgradeneeded = (idbEvent) => {
			const db = (idbEvent.target as any).result as IDBDatabase
			if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name)
			const objectStore = db.createObjectStore(name, { keyPath: key })
			objectStore.createIndex(key, key, { unique: true })
			callbacks.onDBCreateSuccess?.(db)
		}
		request.onsuccess = (idbEvent) => {
			this._db = (idbEvent.target as any).result as IDBDatabase
			const transaction = this._db.transaction(name, "readonly")
			const objectStore = transaction.objectStore(name)

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

	async Create(data: T): Promise<void> {
		if (!this._db) {
			console.error(`[CRT] (${this._name}) Database not initialized`)
		}
		const key = (data as any)[this._key]
		const objectStore = this.getObjectStore("readwrite")
		if (!objectStore) return

		const request = objectStore.add(data)
		return new Promise<void>((resolve, reject) => {
			request.onsuccess = async () => {
				const newValue = { ...this._store.value, [key]: data }
				this._store.next(newValue)
				await this._callbacks.afterUpdate?.(newValue, this._store.value)
				resolve()
			}
			request.onerror = () => {
				console.error(`[CRT] (${this._name}) Error creating data`)
				reject()
			}
		})
	}

	async Update(key: string, data: T): Promise<void> {
		if (!this._db) {
			console.error(`[CRT] (${this._name}) Database not initialized`)
		}
		const objectStore = this.getObjectStore("readwrite")
		if (!objectStore) return

		const request = objectStore.put(data)
		return new Promise<void>((resolve, reject) => {
			request.onsuccess = async () => {
				const newValue = this._store.value
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

	async Delete(key: string) {
		if (!this._db) {
			console.error(`[CRT] (${this._name}) Database not initialized`)
		}

		const objectStore = this.getObjectStore("readwrite")
		if (!objectStore) return

		const request = objectStore.delete(key)
		return new Promise<void>((resolve, reject) => {
			request.onsuccess = async () => {
				const newValue = { ...this._store.value }
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
	callbacks?: StoreCallbacks_t<T>
): [IDBCollectionStore<T>, StoreHook<StoreValue_t<T>>] {
	const store = new IDBCollectionStore<T>(
		config.name,
		config.key,
		config.version,
		callbacks ?? {}
	)

	// prettier-ignore
	const hook = <RT=T,>(
		mapper: (state: StoreValue_t<T>) => RT = (x) => x as any,
		dependencies?: DependencyList
	): RT => {
      const value = useMemo(() => mapper(store.currentValue()), [])
		const [state, setState] = useState<RT>(value)

		const [subscription, setSubscription] = useState<Subscription | null>(null)      
		onMount(() => {
			setSubscription(
				store.subscribe((newState: StoreValue_t<T>) => {
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
