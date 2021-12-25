import { useEffect, useState } from "react";
import { BehaviorSubject } from "rxjs";

export function makeStore<T>(intialValue: T): [BehaviorSubject<T>, () => [T]] {
	const store = new BehaviorSubject(intialValue);
	const hook = (): [T] => {
		const [state, setState] = useState(store.value);
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
