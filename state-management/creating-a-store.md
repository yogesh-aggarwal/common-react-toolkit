# Creating a store

To create a store simply use the `makeStore` function with the following order of arguments:

```tsx
makeStore<VALUE_TYPE>(INITIAL_VALUE, EVENTS, CONFIGURATION)
```

Here's a quick example:

{% code title="State.ts" lineNumbers="true" %}
```tsx
import { makeStore } from "common-react-toolkit"

interface User_t {
    id: string
    name: string
}

export const [userStore, useUser] = makeStore<User_t | null>(null)
```
{% endcode %}

Line 3 creates a new store whose properties are as follows:

* It can store data of type `User_t`.
* At the time of initialization, the value is set to `null`.
* Components can access the value stored in the store by using the `useUser` hook returned by the `makeStore` function.
* To modify/update the store's value, use the `userStore` provided by the `makeStore` function. For example:
