---
description: >-
  Thinking about state management in react & its sisters, it's generally hard to
  manage the state with different kinds of situations in mind.
cover: >-
  https://images.unsplash.com/photo-1668189689991-eab80e81fba2?crop=entropy&cs=tinysrgb&fm=jpg&ixid=MnwxOTcwMjR8MHwxfHJhbmRvbXx8fHx8fHx8fDE2NzA2NTA0NTk&ixlib=rb-4.0.3&q=80
coverY: 0
---

# Introduction

## Doubts while managing state

* Is it feasible to use this state as global?
* How do access the state in a clean & readable way?
* What happens to the component tree when the parent's state changes?
* What is the best way to update the state efficiently?
* How can the files be structured to achieve the maximum understanding of the codebase & state at the same time?

Well, if you have ever experienced the react ecosystem, perhaps you already encountered at least one of the questions in the thought process of writing your application.

To get answers, it's suggested to use the `state management` functionality of the library.&#x20;

## Philosophy

Following the philosophy below, the library is architecture to suit the needs of virtually every scenario out there.

{% hint style="info" %}
Given the ability to break the application's state into smaller chunks called `stores`, components can access only the required ones to help them achieve max. efficiency & neatness with the use of `react hooks`.
{% endhint %}

## Store

The `store` is the most fundamental concept in terms of state management in CRT. Similar to other state management libraries, it holds the provided value as a state. Here's an illustration explaining the store:

<figure><img src="../.gitbook/assets/CRT Illustration 1.svg" alt=""><figcaption><p>Working of a store</p></figcaption></figure>

## Example

{% embed url="https://codesandbox.io/embed/crt-state-management-n0cunq?hidenavigation=1&view=preview" %}
