import { makeStore, makeWorkerStore } from "./CRT"

const [tasksStore, useTasks] = makeStore<string[]>([], {}, { storeID: "ID" })
const [workerStore] = makeWorkerStore<string[]>(
	[],
	"CRT Worker",
	"/worker.js",
	{
		onResponse: (message) => {
			tasksStore.set(message)
		},
	},
	{ inheritStore: tasksStore }
)

export default function App() {
	const value = useTasks((tasks) => tasks.join(", "))

	return (
		<div>
			<button
				onClick={() => {
					tasksStore.set(["helloooooo"])
				}}
			>
				Tasks store
			</button>
			<button
				onClick={() => {
					workerStore.postMessage(["hello", "world"])
				}}
			>
				Click me
			</button>
			{value}
		</div>
	)
}
