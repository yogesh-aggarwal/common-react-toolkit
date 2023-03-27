import { makeStore } from "./Core/CRT"
import { state1Store, state2Store, useState1 } from "./Core/State"

const [userStore, useUser] = makeStore<{
	id: string
	name: { first: string; last: { p1: string; p2: { p1: string; p2: string } } }
}>({
	id: "1",
	name: { first: "John", last: { p1: "D", p2: { p1: "o", p2: "e" } } },
})

export default function App() {
	const user = useUser()
	const user1 = useState1(() => {
		console.log("re")
		return 1
	})

	return (
		<div>
			<div
				onClick={() => {
					userStore.set({
						...userStore.currentValue(),
						name: {
							...userStore.currentValue().name,
							last: {
								...userStore.currentValue().name.last,
								p2: {
									...userStore.currentValue().name.last.p2,
									p1: "a",
								},
							},
						},
					})
				}}
			>
				{JSON.stringify(user)}
			</div>
			<button onClick={() => state1Store.set(state1Store.currentValue() + 1)}>
				+
			</button>
			<button onClick={() => state2Store.set(state2Store.currentValue() + 1)}>
				+
			</button>
		</div>
	)
}
