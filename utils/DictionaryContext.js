import { createContext, useContext } from "react"

export const DictionaryContext = createContext([])

export function useDictionaryContext() {
  return useContext(DictionaryContext)
}