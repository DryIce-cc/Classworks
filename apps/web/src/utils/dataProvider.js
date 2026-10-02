// 数据层：所有数据存本地（IndexedDB），无云端/同步逻辑
import { kvLocalProvider } from './providers/kvLocalProvider'

export const formatResponse = (data) => data

export const formatError = (message, code = 'UNKNOWN_ERROR') => ({
  success: false,
  error: { code, message },
})

// 本地数据提供者：load/save/loadKeys 直透 IndexedDB
export default {
  loadData: async (key) => kvLocalProvider.loadData(key),
  saveData: async (key, data) => kvLocalProvider.saveData(key, data),
  loadKeys: async (options = {}) => kvLocalProvider.loadKeys(options),
}
