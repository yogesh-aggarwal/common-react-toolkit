import * as React from "react"
import { BehaviorSubject, Subscription } from "rxjs"
import { DependencyList, useEffect, useState } from "react"

export type StoreCallbacks<T> = {
	beforeUpdate?: (state: T) => void | Promise<void>
	afterUpdate?: (state: T) => void | Promise<void>
}

export class Store<T> {
	private _store: BehaviorSubject<T>
	private _callbacks: StoreCallbacks<T> = {}
	private _storeID?: string

	constructor(initialValue: T, callbacks: StoreCallbacks<T>, storeID?: string) {
		const localValue = localStorage.getItem(storeID ?? "")
		this._store = new BehaviorSubject<T>(
			localValue ? JSON.parse(localValue) : initialValue
		)
		if (storeID && localValue) {
			localStorage.setItem(storeID, JSON.stringify(initialValue))
		}
		this._callbacks = callbacks
		this._storeID = storeID
	}

	currentValue(): T {
		return this._store.value
	}

	async set(newValue: T): Promise<void> {
		// Before update
		if (this._callbacks.beforeUpdate) {
			await this._callbacks.beforeUpdate(this._store.value)
		}
		// Update value
		if (!newValue) {
			this._store.next(newValue)
		} else {
			this._store.next((newValue as any).valueOf())
		}
		if (this._storeID) {
			localStorage.setItem(this._storeID, JSON.stringify(this._store.value))
		}
		// After update
		if (this._callbacks.afterUpdate) {
			await this._callbacks.afterUpdate(this._store.value)
		}
	}

	merge(newValue: Partial<T>): void {
		this.set({ ...this._store.value, ...newValue })
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

export function makeStore<T>(
	intialValue: T,
	callbacks?: StoreCallbacks<T>,
	options?: {
		local?: boolean
		storeID?: string
	}
): [Store<T>, () => T] {
	const store = new Store<T>(
		intialValue,
		callbacks ? callbacks : {},
		options?.storeID
	)

	const hook = (): T => {
		const [state, setState] = useState(store.currentValue())
		if (options?.local) onUnmount(() => store.set(intialValue))

		useEffect(() => {
			const subscription = store.subscribe((state: T) => {
				setState(state)
			})
			return () => {
				subscription.unsubscribe()
			}
		})
		return state
	}

	return [store, hook]
}

export function If(props: {
	value: any
	children: React.ReactNode | React.ReactNode[]
}): React.ReactElement {
	return props.value ? <>{props.children}</> : <></>
}
