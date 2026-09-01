import { createContext, useContext } from "react"

export const ProfileContext = createContext({
  profile: null,
  setProfile: () => {},
  mofu: 0,
  setMofu: () => {},
  streak: 0,
  setStreak: () => {},
  totalLessons: 0,
  setTotalLessons: () => {},
  totalRounds: 0,
  setTotalRounds: () => {},
})

export function useProfileContext() {
  return useContext(ProfileContext)
}
