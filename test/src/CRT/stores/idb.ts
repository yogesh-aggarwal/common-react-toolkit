import { DependencyList, useEffect, useMemo, useState } from "react"
import isEqual from "react-fast-compare"
import { BehaviorSubject, Subscription } from "rxjs"
import { CRT } from "../core/common"
import { onMount, onUnmount } from "../core/hooks"
import { BasicStore, StoreHook } from "./basic"

export type IDBStoreValue_t<T> = { [key: string]: T }
export type IDBStoreCallbacks_t<T> = {
	afterUpdate?: (
		newState: IDBStoreValue_t<T>,
		prevState: IDBStoreValue_t<T>
	) => any | Promise<any>
	onDBCreateSuccess?: (db: IDBDatabase) => void | Promise<void>
	onDBCreateFail?: () => void | Promise<void>
}

export class IDBCollectionStore<T = any> extends BasicStore<
	IDBStoreValue_t<T>
> {
	private _key: string
	private _name: string
	private _version: number
	private _callbacks: IDBStoreCallbacks_t<T> = {}
	protected _store: BehaviorSubject<IDBStoreValue_t<T>> = new BehaviorSubject(
		{}
	)

	private static _db: IDBDatabase | null = null

	constructor(name: string, key: string, callbacks: IDBStoreCallbacks_t<T>) {
		super()

		this._key = key
		this._name = this._prepareStoreID(name)
		this._version = CRT.CONFIG.dbVersion
		this._callbacks = callbacks

		this.setupDB().then(() => this.loadObjectStore())
	}

	private setupDB() {
		if (IDBCollectionStore._db) return Promise.resolve()

		return new Promise<void>((resolve, reject) => {
			const request = indexedDB.open(this._name, this._version)

			request.onupgradeneeded = (idbEvent) => {
				const db = (idbEvent.target as any).result as IDBDatabase
				for (const name of db.objectStoreNames) db.deleteObjectStore(name)
				resolve()
				this._callbacks.onDBCreateSuccess?.(db)
			}

			request.onsuccess = (idbEvent) => {
				IDBCollectionStore._db = (idbEvent.target as any).result as IDBDatabase
				resolve()
			}
		})
	}

	private setupObjectStore() {
		const db = IDBCollectionStore._db
		if (!db) return

		const objectStore = db.createObjectStore(this._name, { keyPath: this._key })
		objectStore.createIndex(this._key, this._key, { unique: true })
	}

	private getObjectStore(mode: IDBTransactionMode): IDBObjectStore | undefined {
		if (!IDBCollectionStore._db) return undefined
		if (!IDBCollectionStore._db?.objectStoreNames.contains(this._name)) {
			this.setupObjectStore()
		}

		const transaction = IDBCollectionStore._db.transaction(this._name, mode)

		const objectStore = transaction.objectStore(this._name)
		return objectStore
	}

	private loadObjectStore() {
		const objectStore = this.getObjectStore("readonly")
		if (!objectStore) return

		const request = objectStore!.getAll()
		request.onerror = () => {
			console.error(`[CRT] (${this._name}) Error loading data`)
		}
		request.onsuccess = () => {
			const data = request.result.reduce((acc: any, item: any) => {
				acc[item[this._key]] = item
				return acc
			}, {})
			this._store.next(data)
		}
	}

	value(config?: { clone?: boolean }): IDBStoreValue_t<T> {
		if (config?.clone) {
			try {
				return structuredClone(this._store.value)
			} catch {
				return this._store.value
			}
		}
		return Object.freeze(this._store.value)
	}

	async Create(data: T, clear?: boolean): Promise<void> {
		this.Update(data, clear)
	}
	async CreateMany(data: T[], clear?: boolean): Promise<void> {
		this.UpdateMany(data, clear)
	}

	async Update(data: T, clear?: boolean): Promise<void> {
		this.UpdateMany([data], clear)
	}
	async UpdateMany(data: T[], clear?: boolean): Promise<void> {
		if (!IDBCollectionStore._db) {
			console.error(`[CRT] (${this._name}) Database not initialized.`)
		}

		const tx = IDBCollectionStore._db?.transaction(this._name, "readwrite")
		if (!tx) return

		return new Promise<void>((resolve, reject) => {
			const newValue = clear ? {} : { ...this._store.value }
			for (const obj of data) newValue[(obj as any)[this._key]] = obj
			this._store.next(newValue)
			this._callbacks.afterUpdate?.(newValue, this._store.value)

			for (const obj of data) tx.objectStore(this._name).put(obj)
			tx.oncomplete = () => resolve()
			tx.onerror = () => {
				console.error(`[CRT] (${this._name}) Error updating data`)
				reject()
			}
		})
	}

	async Delete(key: string, clear?: boolean) {
		this.DeleteMany([key], clear)
	}
	async DeleteMany(keys: string[], clear?: boolean) {
		if (!IDBCollectionStore._db) {
			console.error(`[CRT] (${this._name}) Database not initialized`)
		}

		const tx = IDBCollectionStore._db?.transaction(this._name, "readwrite")
		if (!tx) return

		return new Promise<void>((resolve, reject) => {
			const newValue = clear ? {} : { ...this._store.value }
			for (const key of keys) delete newValue[key]
			this._store.next(newValue)
			this._callbacks.afterUpdate?.(newValue, this._store.value)

			for (const key of keys) tx.objectStore(this._name).delete(key)
			tx.oncomplete = async () => {
				resolve()
			}
			tx.onerror = () => {
				console.error(`[CRT] (${this._name}) Error deleting data`)
				reject()
			}
		})
	}

	async Clear() {
		if (!IDBCollectionStore._db) {
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
	config: {
		name: string
		key: string
		disableComparison?: boolean
	},
	callbacks?: IDBStoreCallbacks_t<T>
): [IDBCollectionStore<T>, StoreHook<IDBStoreValue_t<T>>] {
	const store = new IDBCollectionStore<T>(
		config.name,
		config.key,
		callbacks ?? {}
	)

	const hook = <RT = T>(
		mapper: (state: IDBStoreValue_t<T>) => RT = (x) => x as any,
		dependencies?: DependencyList
	): RT => {
		const value = useMemo(() => mapper(store.value()), [])
		const [state, setState] = useState<RT>(value)

		const [subscription, setSubscription] = useState<Subscription | null>(null)
		onMount(() => {
			setSubscription(
				store.subscribe((newState: IDBStoreValue_t<T>) => {
					newState = mapper(newState) as any
					setState((prevState: any) => {
						if (!config.disableComparison && isEqual(prevState, newState))
							return prevState
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
