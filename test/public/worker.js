onmessage = (e) => {
	console.log(e.data)

	for (let i = 0; i < 100000; i++) {
		console.log("i")
	}

	postMessage(["Hello", "from", "worker.js"])
}
