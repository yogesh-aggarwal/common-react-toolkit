import { makeIDBDatabaseStore } from "./Core/CRT/Database"

const [tasksStore, useTasks] = makeIDBDatabaseStore({
	name: "tasks",
	key: "id",
	version: 4,
})

export default function App() {
	return (
		<div>
			<button
				onClick={() => {
					for (let i = 0; i < 1000; i++) {
						console.log("Ddwdw")
						tasksStore.Create({
							id: Date.now() + i,
							name: "test " + i,
							description: "test",
							completed: false,
						})
					}
				}}
			>
				Add
			</button>
			<button
				onClick={() => {
					tasksStore.Update("1683695235624", {
						id: 1683695235624,
						name: "test2",
						description: "test",
						completed: false,
					})
				}}
			>
				Update
			</button>
			<button
				onClick={() => {
					tasksStore.Delete("1683695235624")
				}}
			>
				Delete
			</button>
			<button
				onClick={() => {
					tasksStore.Clear()
				}}
			>
				Delete all
			</button>
			{/* <pre>{JSON.stringify(tasks, null, 2)}</pre> */}
		</div>
	)
}
