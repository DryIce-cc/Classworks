// 全局消息：只做一件事——把提示交给 GlobalMessage 弹 snackbar

let snackbarCallback = null

const MESSAGE_TYPE = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
}

function createMessage(type, title, content = '', options = {}) {
  const message = {
    type,
    title,
    content: String(content ?? '').substring(0, 500),
  }
  if (options.showSnackbar !== false) snackbarCallback?.(message)
  return message
}

export default {
  install: (app) => {
    const create = (type) => (title, content, options) =>
      createMessage(type, title, content, options)
    app.config.globalProperties.$message = {
      success: create(MESSAGE_TYPE.SUCCESS),
      error: create(MESSAGE_TYPE.ERROR),
      info: create(MESSAGE_TYPE.INFO),
      warning: create(MESSAGE_TYPE.WARNING),
    }
  },
  onSnackbar: (callback) => {
    snackbarCallback = callback
  },
}
