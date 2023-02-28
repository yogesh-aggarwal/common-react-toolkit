import { makeBoundStore } from "./Core/CRT"
import { state1Store, state2Store, useState1 } from "./Core/State"

const [boundStore, useBoundStore] = makeBoundStore<string>(
	"",
	() => {
		return state1Store.currentValue() + state2Store.currentValue()
	},
	[state1Store]
)

export default function App() {
	const combined = useState1(
		(v) => {
			return v + state2Store.currentValue()
		},
		[state2Store]
	)

	return (
		<div>
			{combined}
			<button onClick={() => state1Store.set(state1Store.currentValue() + 1)}>
				+
			</button>
			<button onClick={() => state2Store.set(state2Store.currentValue() + 1)}>
				+
			</button>
		</div>
	)
}
