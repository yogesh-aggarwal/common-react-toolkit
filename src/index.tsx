import * as React from "react"
import { DependencyList, useEffect, useState } from "react"
import { BehaviorSubject, Subscription } from "rxjs"

export type StoreCallbacks<T> = {
	beforeUpdate?: (newState: T, prevState: T) => any | Promise<any>
	afterUpdate?: (newState: T, prevState: T) => void | Promise<void>
}

namespace Utilities {
	function AreArraysEqual(a: any[], b: any[]): boolean {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) {
			if (!AreEqual(a[i], b[i])) return false
		}
		return true
	}

	function AreObjectsEqual(a: Object, b: Object): boolean {
		const aKeys = Object.keys(a)
		const bKeys = Object.keys(b)
		if (!AreArraysEqual(aKeys, bKeys)) return false
		for (const key of aKeys) {
			if (!AreEqual((a as any)[key], (b as any)[key])) return false
		}

		return true
	}

	export function AreEqual(a: any, b: any): boolean {
		if (typeof a !== typeof b) return false
		if (a === b) return true

		if (Array.isArray(a) && Array.isArray(b)) return AreArraysEqual(a, b)
		if (typeof a === "object") return AreObjectsEqual(a, b)
		return JSON.stringify(a) === JSON.stringify(b)
	}
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
		if (storeID && !localValue) {
			localStorage.setItem(storeID, JSON.stringify(this._store.value))
		}
		this._callbacks = callbacks
		this._storeID = storeID
	}

	currentValue(): T {
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
			localStorage.setItem(this._storeID, JSON.stringify(this._store.value))
		}
		// After update
		await this._callbacks.afterUpdate?.(newValue, this._store.value)
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

type StoreHook<T> = <RT = T>(mapper?: (state: T) => RT) => RT

export function makeStore<T>(
	intialValue: T,
	callbacks?: StoreCallbacks<T>,
	options?: {
		local?: boolean
		storeID?: string
	}
): [Store<T>, StoreHook<T>] {
	const store = new Store<T>(
		intialValue,
		callbacks ? callbacks : {},
		options?.storeID
	)

	// prettier-ignore
	const hook = <RT=T,>(
		mapper?: (state: T) => RT
	): RT => {
		const initialValue = mapper ? mapper(store.currentValue()) : store.currentValue()
		const [state, setState] = useState<RT>(initialValue as any)
		if (options?.local) onUnmount(() => store.set(intialValue))

		useEffect(() => {
			const subscription = store.subscribe((newState: T) => {
				// If filter is defined, only update state if two states are not equal
				newState = mapper
					? mapper(store.currentValue())
					: (store.currentValue() as any)

				if (Utilities.AreEqual(state, newState)) return
				setState(newState as any)
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
