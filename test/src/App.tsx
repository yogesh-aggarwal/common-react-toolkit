import { state1Store, state2Store, useState1, useState2 } from "./Core/State"

export default function App() {
	// const [state, setState] = useState(1)
	// useEffect(() => {
	// 	console.log("Mount")
	// 	const subscription = state1Store.subscribe((newState) => {
	// 		if (!isEqual(state, newState)) setState(newState as any)
	// 	})
	// 	return () => {
	// 		console.log("Unmount")
	// 		subscription.unsubscribe()
	// 	}
	// })

	const state1 = useState1()
	const state2 = useState2()

	return (
		<div>
			<button onClick={() => state1Store.set(state1Store.currentValue() + 1)}>
				+
			</button>
			<button onClick={() => state2Store.set(state2Store.currentValue() + 1)}>
				+
			</button>
		</div>
	)
}
