import { makeStore } from "./CRT"

export const [state1Store, useState1] = makeStore(1, {})
export const [state2Store, useState2] = makeStore("hello", {}, )
