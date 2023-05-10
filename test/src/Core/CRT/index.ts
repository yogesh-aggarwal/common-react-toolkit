export namespace CRT {
	export enum Storage {
		LocalStorage = "localStorage",
		SessionStorage = "sessionStorage",
	}

	type Config_t = {
		application: string
		dbVersion: number

		storage: Storage
		selfRecovery: boolean
		onJSONParseError?: () => any
		storeIDMapper: (storeID: string) => string
	}

	export let CONFIG: Config_t = {
		selfRecovery: false,
		application: "CRT",
		dbVersion: 1,

		storage: Storage.LocalStorage,
		storeIDMapper: (storeID) => storeID,
	}

	export function Clear() {
		if (CONFIG.storage === Storage.LocalStorage) {
			localStorage.clear()
		} else if (CONFIG.storage === Storage.SessionStorage) {
			sessionStorage.clear()
		}
	}

	export function Config(config: Partial<Config_t>) {
		CONFIG = { ...CONFIG, ...config }
	}
}
