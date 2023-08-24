import { DependencyList, useEffect, useMemo, useState } from "react"
import isEqual from "react-fast-compare"
import { Subscription, combineLatest } from "rxjs"
import { BasicStore } from "../stores/basic"
import {
	IDBCollectionStore,
	StorageStoreCallbacks_t,
	StorageStoreConfig_t,
	StoreHook,
} from "../stores/idb"
import { StorageStore, makeStore } from "../stores/storage"
import { onMount, onUnmount } from "./hooks"

export function BindCallback(
	callback: () => any | Promise<void>,
	stores: (BasicStore<any> | IDBCollectionStore<any>)[]
) {
	for (const store of stores) store.subscribe(callback)
}

export function makeBoundStore<T>(
	initialValue: T,
	valueMapper: () => T,
	stores: BasicStore<any>[],
	callbacks?: StorageStoreCallbacks_t<T>,
	options?: Partial<StorageStoreConfig_t>
): [StorageStore<T>, StoreHook<T>] {
	const [store] = makeStore<T>(initialValue, callbacks, options)

	const hook = <RT = T>(
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
						if (!options?.disableComparison && isEqual(prevState, newState))
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
