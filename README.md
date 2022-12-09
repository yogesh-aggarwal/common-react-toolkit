```
Toolkit of common React things to make developer's life a bit easier.
```

# State Management

Thinking about state management in `react & the sisters`, it's generally hard to manage the state with different kinds of situations in mind. Some of them are as follows:

- Is it feasible to use this state as global?
- How do access the state in a clean & readable way?
- What happens to the component tree when the parent's state changes?
- What is the best way to update the state efficiently?
- How can the files be structured to achieve the maximum understanding of the codebase & state at the same time?

Well, if you have ever experienced the react ecosystem, perhaps you already encountered at least one of the questions in the thought process of writing your application.

To get answers, it's suggested to use the `state management` functionality of the library. Following the philosophy below, the library is architecture to suit the needs of virtually every scenario out there.

> Given the ability to break the application's state into smaller chunks called `stores`, components can access only the required ones to help them achieve max. efficiency & neatness with the use of `react hooks`.

Indeed, it's also hard to learn new libraries. Even harder, deciding `whether to make it mainstream for my project or not?`. Perhaps after reading the `"easiest"` usage pattern of the library, you will get convinced of the same.

## Usage

Considering the fact that many developers hate the concept of the global state, the library is based on the concept of `distributed global state` which means despite being global every data variable has its own separate representation/access.

### Creating store

```ts
import { makeStore } from "common-react-toolkit"

const [usernameStore, useUsername] = makeStore<string>("Titter")
```

You might understand the code by looking at it. But if you don't, here we go:

- The first line imports the `makeStore` function from the library.
- The second line, creates the `store` & `hook` respectively by calling the `makeStore` function which takes its "initial state" as the argument.

> And, that's all there's is to it for creating a store!

### Accessing store

Now if you want to use this store, just use it like a normal `react hook`.
Consider the following component:

```ts
function SpookyComponent() {
	const username = useUsername()

	return <div>{username}</div>
}
```

> And, that's how you access the value in the store.

You might be wondering, `well there's no set function`. You're right! Because there's no need for the same. Your component will get `re-rendered` as soon as the store's state changes.

### Modifying store

Remember the `usernameStore`, provided by the `makeStore`? Yes, that's what enables you to handle the current state of the store or any component attached to the store.

Consider the following example:

```ts
import { makeStore } from "common-react-toolkit"

const [usernameStore, useUsername] = makeStore<string>("Titter")

function updateUsername(name: string) {
	usernameStore.set(name)
}
```

While updating `javascript objects`, you might have used `{ ...object }` or `object destructuring` syntax in the past. Well, to avoid that you can use the `.merge()` function instead of `.set()` to achieve the same.

Found easy? Yep, it's as easy as it looks.

### Caching

Ever encountered a situation when you need your state to stay intact even if the application reloads or the browser gets reopened? Caching is your way to go. CRT uses `local storage` for the caching mechanism. If the `storeID` argument is provided to the store configuration, it will store the value of store whenever it gets updated.

```tsx
import { makeStore } from "common-react-toolkit"

export const [usersStore, useUsers] = makeStore<User_t[]>([], {}, { storeID: "users" })
```

### Callbacks

Any store created using `makeStore` function possesses some event callbacks which can be accessed by providing your callback while creating the store

```ts
import { makeStore } from "common-react-toolkit"

export const [usersStore, useUsers] = makeStore<User_t[]>([], {
    beforeUpdate: (newState, prevState) => {
    	// If `true` is returned here, the store won't be updated with the newState. It will hold prevState only
        // Else newState will be set to the store.
        console.log("Before update: ", newState, prevState)
	},
    afterUpdate: (newState, prevState) => {
        console.log("After update: ", newState, prevState)
    }
}, { storeID: "users" })
```

## File structure

File structure is a subjective topic. Unlike other state management tools like `redux`, CRT (Common React Toolkit) doesn't require any file structure for state management. Following are the suggested patterns to be used for the problem of state management:

- Create all the stores under one file for example: `State.ts`.

  ```ts
  // State.ts
  import { makeStore } from "common-react-toolkit"
  
  export const [usersStore, useUsers] = makeStore<User_t[]>([], {}, { storeID: "users" })
  export const [productsStore, useProducts] = makeStore<Product_t[]>([], {}, { storeID: "products" })
  ```

- Use the store outside of the state file to modify the value in it:

  ```ts
  // models/User.ts
  import { usersStore } from "../State"
  
  export function fetchUser(id: string) {
      const user = someServerCall()
      usersStore.merge(user)
  }
  ```

```
some-spooky-project-name/
├─ src/
│  ...
├─ ├─ models/
│  │  ├─ User.ts
│  ├─ State.ts
```

# Helper functions

We all are familiar with the `useEffect` hook. It's usage is pretty simple by default but the only thing it lacks is its readability. Many times it's hard to tell the behavior in the first sight. To tackle this problem, CRT has the following functions embedded but before that here are some notes:

- Callback in every function has added support for being `async` considering its unavailability in the original `useEffect` hook.
- These function are just wrappers over the `useEffect` hook and don't do anything special technically except handling the `async` nature of callbacks.

## `onMount()`

The function will trigger the callback when the component gets mounted (or attached) to the `virtual dom` or in other words gets rendered for the first time.

```ts
// Type Declaration
function onMount(callback: () => void | Promise<void>): void;
```

<u>**For example:**</u>

```ts
import { onMount } from "common-react-toolkit"

function Component() {
    onMount(async () => {
        console.log("Component is mounted.")
    })
}
```

<u>`useEffect()` **alternative:**</u>

```ts
import { useEffect } from "react"

// No async callback is supported.
function Component() {
	useEffect(() => {
        console.log("Component is mounted.")
    }, [])
}
```

## `onUnmount()`

As opposed to the `onMount()` function, this function will trigger the callback when the component get unmounted (or detached) to the `virtual dom`.

```ts
// Type Declaration
function onUnmount(callback: () => void | Promise<void>): void;
```

<u>**For example:**</u>

```ts
import { onUnmount } from "common-react-toolkit"

function Component() {
    onUnmount(async () => {
        console.log("Component is unmounted.")
    })
}
```

`useEffect()` **alternative:**

```ts
import { useEffect } from "react"

// No async callback is supported.
function Component() {
	useEffect(() => {
        return () => {
	        console.log("Component is mounted.")
        }
    }, [])
}
```



##  `onUpdate()`

This function will trigger the callback if the value of any dependency changes during the whole lifecycle of the component.

```ts
// Type Declaration
import { DependencyList } from "react";
function onUpdate(callback: () => void | Promise<void>, dependencies: DependencyList): void;
```

<u>**For example:**</u>

```ts
import { useState } from "react"
import { onUpdate } from "common-react-toolkit"

function Component() {
    const [someState, setSomeState] = useState()
    
    onUpdate(async () => {
        console.log("This callback is only triggered value of someState is changed.")
    }, [someState])
}
```

`useEffect()` **alternative:**

```ts
import { useEffect, useState } from "react"

function Component() {
    const [someState, setSomeState] = useState()
    // No async callback is supported.
    useEffect(() => {
        console.log("This callback is only triggered value of someState is changed.")
    }, [someState])
}
```

> **WARNING:** Never use `onUpdate()` with empty dependency array as it will trigger the provided callback on each & every render of the component resulting in major performance issues and set backs.

## `onLifecycle()`

This function combines the `above 3 helper functions` under one umbrella.

```ts
// Type Declaration
export declare function onLifecycle(events: {
    onMount: () => Promise<void>;
    onUnmount: () => Promise<void>;
    onUpdate?: {
        callback: () => Promise<void>;
        dependencies: DependencyList;
    };
}): void;
```

<u>**For example:**</u>

```ts
import { useState } from "react"
import { onLifecycle } from "common-react-toolkit"

function Component() {
    const [someState, setSomeState] = useState()
    
    onLifecycle({
        onMount: () => {
            console.log("Component is mounted.")
        },
        onUnmount: () => {
            console.log("Component is unmounted.")
        },
        onUpdate: {
            callback: () => {
                console.log("This callback is only triggered value of someState is changed.")
            },
            dependencies: [someState],
        }
    })
}
```

# Components

In some situations we require some components that "just works". CRT has some of them embedded out-of-the-box. These functions are just wrappers over the original react functionalities and ways. To have a good contrast, their <u>original react alternative</u> is also mentioned alongside.

## Conditional rendering

### CRT

```tsx
import { useState } from "react"
import { If } from "common-react-toolkit"

function Component() {
    const [loading, setLoading] = useState<boolean>(false)
    
    return (
        <div>
            <If value={loading}>
                <span>Loading, don't worry 😉</span>
            </If>
            <If value={!loading}>
                <span>Loaded 😉</span>
            </If>
        </div>
    )
}
```

### React

```tsx
import { useState } from "react"

function Component() {
    const [loading, setLoading] = useState<boolean>(false)
    
    return (
        <div>
            {loading ? 
                (
                	<span>Loading, don't worry 😉</span>
            	) :
            	(
                	<span>Loaded 😉</span>
            	)
            }
        </div>
    )
}
```

---

### How to use it at its best?

Have a look at the [`example`](https://github.com/yogesh-aggarwal/common-react-toolkit/example) folder in the repository.
