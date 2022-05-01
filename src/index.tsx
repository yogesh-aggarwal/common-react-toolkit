import * as React from "react"
import { BehaviorSubject, Subscription } from "rxjs"
import { DependencyList, useEffect, useState } from "react"

export type StoreCallbacks<T> = {
	beforeUpdate?: (state: T) => void
	afterUpdate?: (state: T) => void
}

export class Store<T> {
	private _store: BehaviorSubject<T>
	private _callbacks: StoreCallbacks<T> = {}

	constructor(initialValue: T, callbacks: StoreCallbacks<T>) {
		this._store = new BehaviorSubject<T>(initialValue)
		this._callbacks = callbacks
	}

	currentValue(): T {
		return this._store.value
	}

	set(newValue: T): void {
		// Before update
		if (this._callbacks.beforeUpdate) {
			this._callbacks.beforeUpdate(this._store.value)
		}
		// Update value
		if (!newValue) this._store.next(newValue)
		else this._store.next((newValue as any).valueOf())
		// After update
		if (this._callbacks.afterUpdate) {
			this._callbacks.afterUpdate(this._store.value)
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

export function makeStore<T>(
	intialValue: T,
	callbacks?: StoreCallbacks<T>
): [Store<T>, () => T] {
	const store = new Store<T>(intialValue, callbacks ? callbacks : {})

	const hook = (): T => {
		const [state, setState] = useState(store.currentValue())
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

export function onMount(callback: () => void) {
	useEffect(callback, [])
}

export function onUpdate(callback: () => void, dependencies: DependencyList) {
	useEffect(callback, dependencies)
}

export function onUnmount(callback: () => void) {
	useEffect(() => {
		return callback
	}, [])
}

export function onLifecycle(events: {
	onMount: () => void
	onUnmount: () => void
	onUpdate?: { callback: () => void; dependencies: DependencyList }
}): void {
	onMount(events.onMount)
	onUnmount(events.onUnmount)
	if (events.onUpdate)
		onUpdate(events.onUpdate.callback, events.onUpdate.dependencies)
}

export function If(props: {
	value: any
	children: React.ReactNode
}): React.ReactElement {
	return <>{props.value && props.children}</>
}
