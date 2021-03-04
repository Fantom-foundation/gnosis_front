import { loadFromStorage, saveToStorage } from 'src/utils/storage'
import { SafeRecordProps } from 'src/logic/safe/store/models/safe'

export const SAFES_KEY = 'SAFES'
export const DEFAULT_SAFE_KEY = 'DEFAULT_SAFE'

type StoredSafes = Record<string, SafeRecordProps>

export const loadStoredSafes = (): Promise<StoredSafes | undefined> => {
  console.log('loadStoredSafes')
  return loadFromStorage<StoredSafes>(SAFES_KEY)
}

export const getSafeName = async (safeAddress: string): Promise<string | undefined> => {
  console.log('getSafeName')
  const safes = await loadStoredSafes()
  return safes?.[safeAddress]?.name
}

export const saveSafes = async (safes: StoredSafes): Promise<void> => {
  console.log('saveSafes')
  try {
    await saveToStorage(SAFES_KEY, safes)
  } catch (err) {
    console.error('Error storing Safe info in localstorage', err)
  }
}

export const getLocalSafe = async (safeAddress: string): Promise<SafeRecordProps | undefined> => {
  console.log('getLocalSafe')
  const storedSafes = await loadStoredSafes()
  return storedSafes?.[safeAddress]
}

export const getDefaultSafe = async (): Promise<string> => {
  const defaultSafe = await loadFromStorage<string>(DEFAULT_SAFE_KEY)
  console.log('getDefaultSafe')

  return defaultSafe || ''
}

export const saveDefaultSafe = async (safeAddress: string): Promise<void> => {
  console.log('saveDefaultSafe')
  try {
    await saveToStorage(DEFAULT_SAFE_KEY, safeAddress)
  } catch (err) {
    // eslint-disable-next-line
    console.error('Error saving default Safe to storage: ', err)
  }
}
