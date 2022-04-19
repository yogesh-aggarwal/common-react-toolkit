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

To get answers, it's suggested to use the `state management` functionality of the library. Following the philosophy below, the library is architectured to suit the needs of virtually every scenario out there.

> Given the ability to break the application's state into smaller chunks called `stores`, components can access only the required ones to help them achieve max. efficiency & neatness with the use of `react hooks`.

Indeed, it's also hard to learn new libraries. Even harder, deciding `whether to make it mainstream for my project or not?`. Perhaps after reading the `"easiest"` usage pattern of the library, you will get convinced of the same.

## Usage

Considering the fact that many developers hate the concept of the global state, the library is based on the concept of `distributed global state` which means despite being global every data variable has its own separate representation/access.

### Creating store

```ts
import { makeStore } from "common-react-toolkit";

const [usernameStore, useUsername] = makeStore<string>("Titter");
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
	const [username] = useUsername();

	return <div>{username}</div>;
}
```

> And, that's how you access the value in the store.

You might be wondering, `well there's any set function`. You're right! But there's no need for the same. Your component will get `re-rendered` as soon as the store's state changes.

# Modifying store

Remember the `usernameStore`, provided by the `makeStore`? Yes, that's what enables you to handle the current state of the store or any component attached to the store.

Consider the following example:

```ts
import { makeStore } from "common-react-toolkit";

const [usernameStore, useUsername] = makeStore<string>("Titter");

function updateUsername(name: string) {
	usernameStore.set(name);
}
```

While updating `javascript objects`, you might have used `{ ...object }` or `object destructuring` syntax in the past. Well, to avoid that you can use the `.merge()` function instead of `.set()` to achieve the same.

Found easy? Yep, it's as easy as it looks.

## File structure

Although file structure is a subjective topic, the following one is preferred:

```
some-spooky-project-name/
├─ src/
│  ...
│  ├─ State/
│  │  ├─ User.ts
│  │  ├─ Auth.ts
```

## How to use it at its best?

Have a look at the [`example`](https://github.com/yogesh-aggarwal/common-react-toolkit/example) folder in the repository.
