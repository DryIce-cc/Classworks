// 精简版设置：仅保留字体大小；其余行为均使用默认值（见各组件内硬编码常量）
// 已移除：服务器/云端、刷新、背景、通知铃声、一言、随机点名、噪音、花名册、消息、
// 预配链接、关于、时间卡片、开发者开关（一律启用）、一体机模式（一律启用）、
// 编辑自动保存（一律启用）、保存提示文案、主题（一律深色）、PWA 隐藏卡片

const SETTINGS_STORAGE_KEY = 'Classworks_settings'
const SETTINGS_CHANGED_EVENT = 'classworks:settings:changed'

// 所有配置项的定义（精简版）
const settingsDefinitions = {
  // 字体设置（唯一保留的可配置项）
  'font.size': {
    type: 'number',
    default: 28,
    validate: (value) => value >= 16 && value <= 100,
    description: '字体大小',
    icon: 'mdi-format-size',
  },
}

class SettingsManagerClass {
  constructor() {
    this.settingsCache = null
    this.isInitialized = false
  }

  init() {
    if (this.isInitialized) return
    this.loadSettings()
    this.isInitialized = true
  }

  loadSettings() {
    this.settingsCache = {}
    try {
      const stored =
        typeof localStorage !== 'undefined' ? localStorage.getItem(SETTINGS_STORAGE_KEY) : null
      if (stored) {
        this.settingsCache = JSON.parse(stored)
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
    for (const [key, definition] of Object.entries(settingsDefinitions)) {
      if (!(key in this.settingsCache)) {
        this.settingsCache[key] = definition.default
      }
    }
    return this.settingsCache
  }

  saveSettings() {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settingsCache))
    } catch (error) {
      console.error('保存设置失败:', error)
    }
  }

  getSetting(key) {
    if (!this.isInitialized) this.init()
    const definition = settingsDefinitions[key]
    if (!definition) {
      console.warn(`未定义的设置项: ${key}`)
      return null
    }
    const value = this.settingsCache[key]
    return value !== undefined ? value : definition.default
  }

  setSetting(key, value) {
    if (!this.isInitialized) this.init()
    const definition = settingsDefinitions[key]
    if (!definition) {
      console.warn(`未定义的设置项: ${key}`)
      return false
    }
    try {
      const oldValue = this.settingsCache[key]
      if (typeof value !== definition.type) {
        value =
          definition.type === 'boolean'
            ? Boolean(value)
            : definition.type === 'number'
              ? Number(value)
              : String(value)
      }
      if (definition.validate && !definition.validate(value)) {
        console.warn(`设置项 ${key} 的值无效`)
        return false
      }
      this.settingsCache[key] = value
      this.saveSettings()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: { key, value } }),
        )
      }
      const legacyKey = definition.legacyKey
      if (legacyKey && typeof localStorage !== 'undefined') {
        localStorage.setItem(legacyKey, value.toString())
      }
      return true
    } catch (error) {
      console.error(`设置配置项 ${key} 失败:`, error)
      return false
    }
  }

  resetSetting(key) {
    if (!this.isInitialized) this.init()
    const definition = settingsDefinitions[key]
    if (!definition) {
      console.warn(`未定义的设置项: ${key}`)
      return
    }
    this.settingsCache[key] = definition.default
    this.saveSettings()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: { key, value: definition.default } }),
      )
    }
  }

  resetAllSettings() {
    this.settingsCache = {}
    for (const [key, definition] of Object.entries(settingsDefinitions)) {
      this.settingsCache[key] = definition.default
    }
    this.saveSettings()
  }

  watchSettings(callback) {
    if (typeof window === 'undefined') return () => {}
    const storageHandler = (event) => {
      if (event.key === SETTINGS_STORAGE_KEY) {
        this.settingsCache = JSON.parse(event.newValue)
        callback(this.settingsCache, null)
      }
    }
    const customHandler = (event) => {
      callback(this.settingsCache, event)
    }
    window.addEventListener('storage', storageHandler)
    window.addEventListener(SETTINGS_CHANGED_EVENT, customHandler)
    return () => {
      window.removeEventListener('storage', storageHandler)
      window.removeEventListener(SETTINGS_CHANGED_EVENT, customHandler)
    }
  }

  getSettingDefinition(key) {
    return settingsDefinitions[key] || null
  }

  exportSettingsAsKeyValue() {
    if (!this.isInitialized) this.init()
    const exportedSettings = {}
    for (const key in settingsDefinitions) {
      exportedSettings[key] = this.getSetting(key)
    }
    return exportedSettings
  }
}

const SettingsManager = new SettingsManagerClass()

if (typeof window !== 'undefined') {
  SettingsManager.init()
}

const getSetting = (key) => SettingsManager.getSetting(key)
const setSetting = (key, value) => SettingsManager.setSetting(key, value)
const resetSetting = (key) => SettingsManager.resetSetting(key)
const resetAllSettings = () => SettingsManager.resetAllSettings()
const watchSettings = (callback) => SettingsManager.watchSettings(callback)
const getSettingDefinition = (key) => SettingsManager.getSettingDefinition(key)
const exportSettingsAsKeyValue = () => SettingsManager.exportSettingsAsKeyValue()

export {
  settingsDefinitions,
  SettingsManager,
  getSetting,
  setSetting,
  resetSetting,
  resetAllSettings,
  watchSettings,
  getSettingDefinition,
  exportSettingsAsKeyValue,
}
