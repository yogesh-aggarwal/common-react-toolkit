export namespace CRT {
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

      storage: localStorage,
      storeIDMapper: (storeID) => storeID,
   }

   export function Clear() {
      CONFIG.storage.clear()
   }

   export function Config(config: Partial<Config_t>) {
      CONFIG = { ...CONFIG, ...config }
   }
}
