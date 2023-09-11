import { DependencyList } from "react"
import { BehaviorSubject, Subscription } from "rxjs"
import { CRT } from "../core/common"

export type StoreHook<T> = <RT = T>(mapper?: (state: T) => RT, dependencies?: DependencyList) => RT

export abstract class BasicStore<T> {
   protected abstract _store: BehaviorSubject<T>
   protected abstract _initialValue: T

   get store() {
      return this._store
   }

   abstract reset(): Promise<void>

   initialValue(): T {
      return Object.freeze(this._initialValue)
   }

   value(config?: { clone?: boolean }): T {
      if (config?.clone) {
         try {
            return structuredClone(this._store.value)
         } catch {
            return this._store.value
         }
      }
      return Object.freeze(this._store.value)
   }

   /**
    * @deprecated
    */
   currentValue(): T {
      return this.value()
   }

   subscribe(callback: (state: T) => void): Subscription {
      return this._store.subscribe(callback)
   }

   unsubscribe() {
      this._store.unsubscribe()
   }

   protected _prepareStoreID(storeID: string): string {
      return `[${CRT.CONFIG.application}.v${CRT.CONFIG.dbVersion}] ${CRT.CONFIG.storeIDMapper(storeID)}`
   }
}
