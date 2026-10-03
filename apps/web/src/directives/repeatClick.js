/**
 * v-repeat-click：按住不放就连续触发
 *
 * 用法：v-repeat-click="fn"
 *      v-repeat-click="{ handler: fn, delay: 350, interval: 60 }"
 *
 * 行为照搬 Element Plus 的 v-repeat-click，改用 pointer 事件，鼠标和触屏共用一套代码。
 * 和 v-btn 一起用没问题：指令落在组件根元素上，触发时机是 pointerdown，
 * 比 click 早，正好配得上按钮上的 @mousedown.prevent（按住时别把焦点从输入框抢走）。
 */

// 按住多久才开始连发，太短容易误触
const DEFAULT_DELAY = 250
// 连发间隔
const DEFAULT_INTERVAL = 30

// 挂在元素上，用来在卸载时收回监听和定时器
const SCOPE = '_repeatClick'

export default {
  mounted(el, binding) {
    const value = binding.value
    const options = typeof value === 'function' ? { handler: value } : value || {}
    const handler = options.handler
    if (typeof handler !== 'function') return

    const delay = options.delay ?? DEFAULT_DELAY
    const interval = options.interval ?? DEFAULT_INTERVAL

    let delayTimer = 0
    let repeatTimer = 0
    // 按下的那根指针：多指触摸时只认第一根，免得抬起别的手指就把连发停了
    let pointerId = null

    const stop = () => {
      if (delayTimer) window.clearTimeout(delayTimer)
      if (repeatTimer) window.clearInterval(repeatTimer)
      delayTimer = 0
      repeatTimer = 0
      pointerId = null
    }

    const start = (event) => {
      // 右键/中键不算，第二次按下也不重开一轮
      if (event.button > 0 || pointerId !== null) return
      pointerId = event.pointerId
      // 先立刻响应这一次，之后才是连发
      handler()
      delayTimer = window.setTimeout(() => {
        repeatTimer = window.setInterval(handler, interval)
      }, delay)
    }

    // 抬起和取消都算结束。挂到 document 的捕获阶段，指针移出按钮、甚至移出窗口也照样收得到。
    // 划出按钮不停止连发，和原生 SpinButton 一样，一直按到抬起为止
    const stopOnRelease = (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return
      stop()
    }

    el[SCOPE] = { start, stop, stopOnRelease }
    el.addEventListener('pointerdown', start)
    document.addEventListener('pointerup', stopOnRelease, true)
    document.addEventListener('pointercancel', stopOnRelease, true)
  },

  beforeUnmount(el) {
    const scope = el[SCOPE]
    if (!scope) return
    scope.stop()
    el.removeEventListener('pointerdown', scope.start)
    document.removeEventListener('pointerup', scope.stopOnRelease, true)
    document.removeEventListener('pointercancel', scope.stopOnRelease, true)
    delete el[SCOPE]
  },
}
