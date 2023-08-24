import { DependencyList, useEffect, useMemo, useState } from "react"
import isEqual from "react-fast-compare"
import { BehaviorSubject, Subscription } from "rxjs"
import { onMount, onUnmount } from "../core/hooks"
import { BasicStore, StoreHook } from "./basic"

export type WorkerStoreCallbacks_t<RT = any, MT = any> = {
	beforeUpdate?: (newState: RT, prevState: RT) => any | Promise<any>
	afterUpdate?: (newState: RT, prevState: RT) => any | Promise<any>

	onMessage?: (message: MT) => any
	onResponse?: (message: RT) => any
	onError?: (message: ErrorEvent) => any
	onMessageError?: (message: MessageEvent) => any

	onInitialized?: () => any
	onTerminated?: () => any
}

export type WorkerStoreConfig_t<T> = {
	inheritStore?: BasicStore<T>
	disableComparison: boolean
	credentials: RequestCredentials
}

export class WorkerStore<RT = any, MT = any> extends BasicStore<RT> {
	protected _store: BehaviorSubject<RT>
	private _disableComparison?: boolean
	private _workerURL: string
	private _workerName: string
	private _credentials: RequestCredentials
	private _callbacks: WorkerStoreCallbacks_t<RT, MT> = {}
	private _inheritStore?: BasicStore<RT>

	private static _workers: Map<string, Worker> = new Map()

	get storeID() {
		return this._workerURL
	}
	get store() {
		return this._store
	}

	constructor(
		initialValue: RT,
		callbacks: WorkerStoreCallbacks_t<RT, MT>,
		workerName: string,
		workerURL: string,
		inheritStore?: BasicStore<RT>,
		credentials?: RequestCredentials,
		disableComparison?: boolean
	) {
		super()

		this._workerURL = workerURL
		this._workerName = workerName
		this._callbacks = callbacks
		this._inheritStore = inheritStore
		this._credentials = credentials ?? "same-origin"
		this._disableComparison = disableComparison

		this._store = new BehaviorSubject<RT>(
			this._inheritStore?.value() ?? initialValue
		)

		this.setupWorker()
	}

	private setupWorker() {
		if (WorkerStore._workers.get(this._workerURL)) return

		const worker = new Worker(this._workerURL, {
			name: this._workerName,
			credentials: this._credentials,
			type: "module",
		})
		worker.onmessage = async (e) => {
			const newValue = e.data as RT

			this._callbacks.onResponse?.(newValue)

			if (!this._disableComparison && isEqual(newValue, this._store.value))
				return

			const prevValue = Object.freeze(this._store.value)

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
			// After update
			await this._callbacks.afterUpdate?.(newValue, prevValue)
		}
		worker.onmessageerror = (e) => {
			this._callbacks.onMessageError?.(e)
		}
		worker.onerror = (e) => {
			this._callbacks.onError?.(e)
		}

		WorkerStore._workers.set(this._workerURL, worker)

		this._callbacks.onInitialized?.()
	}

	public terminate() {
		const worker = WorkerStore._workers.get(this._workerURL)
		if (!worker) {
			console.error(
				`[CRT] (${this._workerName}) Web worker not initialized yet.`
			)
			return
		}

		worker.terminate()
		WorkerStore._workers.delete(this._workerURL)

		this._callbacks.onTerminated?.()
	}

	public postMessage(message: MT) {
		const worker = WorkerStore._workers.get(this._workerURL)
		if (!worker) {
			console.error(
				`[CRT] (${this._workerName}) Web worker not initialized yet.`
			)
			return
		}

		this._callbacks.onMessage?.(message)
		WorkerStore._workers.get(this._workerURL)!.postMessage(message)
	}
}

export function makeWorkerStore<RT = any, MT = any>(
	initialValue: RT,
	workerName: string,
	workerURL: string,
	callbacks?: WorkerStoreCallbacks_t<RT, MT>,
	config?: Partial<WorkerStoreConfig_t<RT>>
): [WorkerStore<RT>, StoreHook<RT>] {
	console.log(config)
	const store = new WorkerStore<RT, MT>(
		initialValue,
		callbacks ? callbacks : {},
		workerName,
		workerURL,
		config?.inheritStore,
		config?.credentials,
		config?.disableComparison
	)

	const hook = <RTV = RT>(
		mapper: (state: RT) => RTV = (x) => x as any,
		dependencies?: DependencyList
	): RTV => {
		const value = useMemo(() => mapper(store.value()), [])
		const [state, setState] = useState<RTV>(value)

		const [subscription, setSubscription] = useState<Subscription | null>(null)
		onMount(() => {
			setSubscription(
				store.subscribe((newState: RT) => {
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
