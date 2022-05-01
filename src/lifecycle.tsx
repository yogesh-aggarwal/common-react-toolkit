import { DependencyList, useEffect } from "react"

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
