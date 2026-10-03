// 数据层：所有数据都存在本地 IndexedDB，无云端/同步逻辑。
// 失败的返回值统一是 { success: false, error: { code, message } }，调用方靠 success 判成败。
import { openDB } from 'idb'

const DB_NAME = 'ClassworksDB'
// 版本号只增不改：老用户库里已无人使用的 store 不要在这里动，升版本会触发迁移
const DB_VERSION = 3

const initDB = () =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv')
      }
    },
  })

const formatError = (message, code = 'UNKNOWN_ERROR') => ({
  success: false,
  error: { code, message },
})

export default {
  async loadData(key) {
    try {
      const db = await initDB()
      const raw = await db.get('kv', key)
      if (!raw) return formatError('数据不存在', 'NOT_FOUND')
      return JSON.parse(raw)
    } catch (error) {
      return formatError('读取本地数据失败：' + error)
    }
  },

  async saveData(key, data) {
    try {
      const db = await initDB()
      await db.put('kv', JSON.stringify(data), key)
      return true
    } catch (error) {
      return formatError('保存本地数据失败：' + error)
    }
  },

  // 列出存档名。调用方要多少给多少（受 limit 限制）
  async loadKeys({ limit = 100 } = {}) {
    try {
      const db = await initDB()
      const keys = await db.getAllKeys('kv')
      return { keys: keys.sort().slice(0, limit) }
    } catch (error) {
      return formatError('获取本地键名列表失败：' + error.message)
    }
  },
}
