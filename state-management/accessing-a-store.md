# Accessing a store

Any component at any level of the component tree can access the value stored in the component by `using` the hook provided by the `makeStore` function. Consider the following bare minimum example which accesses the properties of the current user by using the `useUser` hook:

{% code title="UserComponent.tsx" lineNumbers="true" %}
```tsx
function UserNameComponent() {
    const user = useUser()
    if (!user) return <div>User is not authenticated</div>
    return <div>User ID: {user.id}</div>
}
```
{% endcode %}

Whenever the store changes its value, the component will get notified and re-rendered automatically. No extra subscription models are required anyway.

## Mapping store value

{% hint style="info" %}
The concept of `mapping` in CRT resembles the concept of `slicing` in libraries like `redux`.
{% endhint %}

In the above example itself, the component deals only with the `id` property of the `user` object. That means if any property of the user changes, the component will re-render regardless of the requirements.

To prevent the unnecessary re-rendering of the components, we can use the `mapping` ability of the `hook` provided by CRT to selectively bind the properties of the value of a store (in the case of objects).

{% code title="UserName.tsx" lineNumbers="true" %}
```tsx
function UserComponent() {
    const userID = useUser(user => user?.id)
    if (!userID) return <div>User is not authenticated</div>
    return <div>User ID: {userID}</div>
}
```
{% endcode %}

This component will **re-render only** when the `id` property of the value of the store changes. In this scenario, even if any other property like `name` gets changed, the component won't be re-rendered.
