import { DependencyList, RefObject, useEffect, useMemo, useState } from "react"
import { Subscription, combineLatest } from "rxjs"
import { BasicStore } from "../stores/basic"
import { IDBCollectionStore } from "../stores/idb"

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
	stores: (BasicStore<any> | IDBCollectionStore<any>)[]
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
