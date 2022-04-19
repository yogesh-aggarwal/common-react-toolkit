import { useEffect, useState } from "react";
import { Store } from "./store";
export function makeStore(intialValue, callbacks) {
    const store = new Store(intialValue, callbacks ? callbacks : {});
    const hook = () => {
        const [state, setState] = useState(store.currentValue());
        useEffect(() => {
            const subscription = store.subscribe((state) => {
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
