import { useEffect, useState } from "react";
import { Store, StoreCallbacks } from "./store";

export function makeStore<T>(
	intialValue: T,
	callbacks?: StoreCallbacks<T>
): [Store<T>, () => [T]] {
	const store = new Store<T>(intialValue, callbacks ? callbacks : {});

	const hook = (): [T] => {
		const [state, setState] = useState(store.currentValue());
		useEffect(() => {
			const subscription = store.subscribe((state: T) => {
				setState(state);
			});
			return () => {
				subscription.unsubscribe();
			};
		});
		return [state];
	};
	return [store, hook];
}
