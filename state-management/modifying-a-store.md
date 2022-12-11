# Modifying a store

Stores are meant to be used as a global state. The advantage of being global is that components at any level of the component tree have the ability to modify the value of the state. To ease out the process of updating the store's value, a store handler is provided by the `makeStore` function. In the example, it is the `userStore` variable.

Consider the following example which updates the `user store` after authentication from the server:

{% code title="Auth.ts" lineNumbers="true" %}
```tsx
function Authenticate() {
    const res = someAuthCall()
    userStore.set({
        id: res.body.id,
        name: res.body.name,
    })
}
```
{% endcode %}

As soon as the `set` function gets called, every component bound with the `useUser` hook will get notified regardless of their mapping function. But the component will get re-rendered **only & only** based on its mapping function. If the value after mapping is the same, the component won't get re-rendered saving a lot of performance issues and improving the overall `user experience`.

## Methods of updating

The value of a store can be modified in any of the mentioned forms:

1. Replace the current value with the new value.
2. Merge the new value with the current value.

### `set()` function

To replace the current store value with the new value, `set()` function is used on the store with the help of the store handler provided by the `makeStore` function. This function is **applicable to any type of data**.

```tsx
async function FetchUserName() {
    const res = await getUser()
    userStore.set({
        name: res.body.name,
    })
}
```

In the above example, the whole value will be replaced by the new one.

### `merge()` function&#x20;

To merge the current store value with the new value, `set()` function is used on the store with the help of the store handler provided by the `makeStore` function. This function is **applicable to only arrays & objects**.

```tsx
async function FetchUserName() {
    const res = await getUser()
    userStore.merge({
        name: res.body.name,
    })
}
```

In the above example, only `name` field will be updated in the store value.
