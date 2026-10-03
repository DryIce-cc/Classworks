<!-- 作业编辑对话框：一个编辑框，靠日期小标题两侧的按钮切换要编辑哪一天 -->
<template>
  <v-dialog
    v-model="dialogVisible"
    :fullscreen="false"
    width="900"
    max-width="calc(100vw - 48px)"
    content-class="homework-dialog-content"
    persistent
  >
    <v-card border @keydown="handleKeydown">
      <!-- 顶部倒计条：5s 内一动不动就自动关掉，防的是误触打开 -->
      <div v-if="countdownActive" class="close-countdown">
        <div class="close-countdown-bar" :style="closeCountdownStyle" />
      </div>

      <v-card-title class="d-flex align-center">
        {{ title }}
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" @click="handleClose" />
      </v-card-title>

      <!-- 标题栏已经占了一行，这里把内容顶上来，免得科目名与内容之间空一大块 -->
      <v-card-text style="padding-top: 4px">
        <div class="d-flex">
          <div class="flex-grow-1">
            <!-- 日期小标题 + 切换日期的按钮；没有下限，一直能往前翻，只在已经离开今天时给「回到今天」 -->
            <div class="date-caption">
              {{ dayName }}的作业
              <v-spacer />
              <v-btn
                v-if="canGoToday"
                size="small"
                class="today-btn"
                variant="text"
                rounded="pill"
                title="回到今天"
                @mousedown.prevent
                @click="goToday"
              >
                回到今天
              </v-btn>
              <v-btn
                icon="mdi-chevron-left"
                size="small"
                variant="text"
                title="上一天"
                @mousedown.prevent
                @click="shiftDate(-1)"
              />
              <!-- close-on-content-click 必须为 false：默认 true 会在选择器里点任何地方都把它自己关掉 -->
              <v-menu v-model="pickerOpen" :close-on-content-click="false" location="bottom">
                <template #activator="{ props: activatorProps }">
                  <v-btn
                    v-bind="activatorProps"
                    icon="mdi-calendar"
                    size="small"
                    variant="text"
                    title="选择日期"
                  />
                </template>
                <v-card border rounded="md">
                  <v-date-picker
                    :model-value="currentDateObj"
                    color="primary"
                    @update:model-value="selectDate"
                  />
                </v-card>
              </v-menu>
              <v-btn
                prepend-icon="mdi-chevron-right"
                rounded="pill"
                variant="text"
                size="small"
                title="下一天"
                @mousedown.prevent
                @click="shiftDate(1)"
              >
                {{ nextDayName }}
              </v-btn>
            </div>

            <v-textarea
              ref="inputRef"
              v-model="content"
              auto-grow
              placeholder="使用换行表示分条"
              rows="5"
              class="hw-area"
              @click="updateCurrentLine"
              @keyup="updateCurrentLine"
            />

            <div class="paste-bar">
              <v-btn
                size="small"
                variant="outlined"
                prepend-icon="mdi-content-paste"
                @mousedown.prevent
                @click="pasteFromClipboard"
              >
                粘贴
              </v-btn>
              <v-btn
                size="small"
                variant="elevated"
                color="primary"
                prepend-icon="mdi-content-paste"
                @click="pasteAndComplete"
              >
                粘贴并完成
              </v-btn>
            </div>

            <!-- Template Buttons Section -->
            <div v-if="templateData" class="mt-4">
              <div v-if="hasTemplates" class="template-buttons">
                <!-- 本学科的作业本在前，公共作业本在后 -->
                <div v-for="group in bookGroups" :key="group.book" class="button-group">
                  <v-chip
                    :color="isBookSelected(group.book) ? 'success' : 'default'"
                    :variant="isBookSelected(group.book) ? 'elevated' : 'flat'"
                    class="ma-1 book-chip"
                    @mousedown.prevent
                    @click="handleBookClick(group.book)"
                  >
                    {{ group.book }}
                  </v-chip>

                  <!-- Show pages only if book is selected -->
                  <div v-if="isBookSelected(group.book)" class="pages-container mt-2">
                    <v-chip
                      v-for="page in group.pages"
                      :key="page"
                      :color="isPageSelected(group.book, page) ? 'info' : 'default'"
                      :variant="isPageSelected(group.book, page) ? 'elevated' : 'flat'"
                      class="ma-1"
                      @mousedown.prevent
                      @click="handlePageClick(group.book, page)"
                    >
                      {{ page }}
                    </v-chip>
                  </div>
                </div>

                <!-- Actions -->
                <div v-if="templateData.actions?.length" class="button-group">
                  <v-chip
                    v-for="action in templateData.actions"
                    :key="action"
                    class="ma-1"
                    color="primary"
                    variant="flat"
                    @mousedown.prevent
                    @click="insertTemplate(action)"
                  >
                    {{ action }}
                  </v-chip>
                </div>
              </div>
              <div v-else class="text-center text-body-2 text-disabled mt-2">暂无可用的模板</div>
            </div>
          </div>

          <!-- Quick Tools Section -->
          <div class="quick-tools ml-4" style="min-width: 180px">
            <!-- Numeric Keypad -->
            <div class="numeric-keypad mb-4">
              <div class="keypad-row">
                <v-btn
                  v-for="n in 3"
                  :key="n"
                  class="keypad-btn"
                  size="small"
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor(String(n))"
                >
                  {{ n }}
                </v-btn>
              </div>
              <div class="keypad-row">
                <v-btn
                  v-for="n in 3"
                  :key="n"
                  class="keypad-btn"
                  size="small"
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor(String(n + 3))"
                >
                  {{ n + 3 }}
                </v-btn>
              </div>
              <div class="keypad-row">
                <v-btn
                  v-for="n in 3"
                  :key="n"
                  class="keypad-btn"
                  size="small"
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor(String(n + 6))"
                >
                  {{ n + 6 }}
                </v-btn>
              </div>
              <div class="keypad-row">
                <v-btn
                  class="keypad-btn"
                  size="small"
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor('-')"
                >
                  -
                </v-btn>
                <v-btn
                  class="keypad-btn"
                  size="small"
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor('0')"
                >
                  0
                </v-btn>
                <v-btn
                  class="keypad-btn"
                  color="error"
                  size="small"
                  variant="tonal"
                  @mousedown.prevent
                  @click="deleteLastChar"
                >
                  ←
                </v-btn>
              </div>
              <div class="keypad-row">
                <v-btn
                  class="keypad-btn space-btn"
                  size="small"
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor(' ')"
                >
                  空格
                </v-btn>
                <v-btn
                  class="keypad-btn space-btn"
                  size="small"
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor('\n')"
                >
                  换行
                </v-btn>
              </div>
            </div>

            <div class="d-flex flex-wrap quick-texts">
              <v-btn
                v-for="text in quickTexts"
                :key="text"
                size="small"
                variant="flat"
                @mousedown.prevent
                @click="insertAtCursor(text)"
              >
                {{ text }}
              </v-btn>
            </div>
          </div>
        </div>
      </v-card-text>

      <div class="text-center text-body-2 text-disabled mb-5">点击空白处完成编辑</div>
    </v-card>
  </v-dialog>
</template>

<script>
import dataProvider from '@/utils/dataProvider'
import { formatDayName, parseDateString, shiftDateString, toDateString } from '@/utils/date'

// 点在这些元素上（或紧贴着它们）都不算「点空白」，别关面板。
// 里面不能出现 .v-overlay__content：它是对话框自己的内容容器，整张卡片都在它里面。
const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="button"], .v-btn, .v-chip, .v-field, .v-list-item'
// 按下到抬起的位移超过这个值就当作滚动，不关面板
const TAP_SLOP = 10
// 离控件这么近以内也算点到了它
const NEAR_PADDING = 30
// 打开后 5s 内一动不动就自动关掉，防的是误触打开
const IDLE_CLOSE_DELAY = 5000

export default {
  name: 'HomeworkEditDialog',
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    // 既是卡片标题，也是存档里的 key
    title: {
      type: String,
      required: true,
    },
    // 打开时停在哪一天：外面展示板正在看的那天，这样点哪张卡就是改哪天的
    initialDate: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue', 'save'],
  data() {
    return {
      // 日期 -> 正文。翻到别的日期再翻回来时，这一天的改动还在，
      // 关闭时一次性把所有改动过的日期写回去。
      drafts: {},
      initialDrafts: {},
      // 当前正在编辑哪一天
      currentDate: '',
      templateData: null,
      currentLine: '',
      currentLineStart: 0,
      currentLineEnd: 0,
      quickTexts: ['课', '题', '例', '变', 'T', 'P'],
      pickerOpen: false,
      // 顶部倒计条是否在走，false 表示已经不需要倒计了
      countdownActive: false,
    }
  },
  created() {
    // 按下位置，不进响应式：只是用来判断这一下算不算「点击空白」
    this._press = null
    // 倒计的定时器
    this._closeTimer = 0
  },
  mounted() {
    // 用捕获阶段监听，按钮、浮层挡在前面也照样能收到
    document.addEventListener('pointerdown', this.handlePressStart, true)
    document.addEventListener('pointerup', this.handlePressEnd, true)
    document.addEventListener('pointercancel', this.cancelPress, true)
    // 任何一点动静都撤掉倒计：按下、按键、滚轮统统算「有人在用面板」。
    // 同样走捕获阶段，焦点落到面板外也照样收得到。
    document.addEventListener('pointerdown', this.cancelCloseCountdown, true)
    document.addEventListener('keydown', this.cancelCloseCountdown, true)
    document.addEventListener('wheel', this.cancelCloseCountdown, { capture: true, passive: true })
  },
  beforeUnmount() {
    document.removeEventListener('pointerdown', this.handlePressStart, true)
    document.removeEventListener('pointerup', this.handlePressEnd, true)
    document.removeEventListener('pointercancel', this.cancelPress, true)
    document.removeEventListener('pointerdown', this.cancelCloseCountdown, true)
    document.removeEventListener('keydown', this.cancelCloseCountdown, true)
    document.removeEventListener('wheel', this.cancelCloseCountdown, true)
    this.stopCloseCountdown()
  },
  computed: {
    dialogVisible: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
      },
    },
    // 正文始终指向当前这一天，模板、粘贴、快捷键盘都走它
    content: {
      get() {
        return this.drafts[this.currentDate] || ''
      },
      set(value) {
        this.drafts[this.currentDate] = value
      },
    },
    todayString() {
      return toDateString(new Date())
    },
    // 打开时停在哪一天。展示板给的是它正在看的那天，
    // 拿不到（还没初始化）或格式不对时就从今天开始
    startDate() {
      return /^\d{8}$/.test(this.initialDate) ? this.initialDate : this.todayString
    },
    currentDateObj() {
      return parseDateString(this.currentDate)
    },
    dayName() {
      return formatDayName(this.currentDate)
    },
    // 「下一天」按钮上的文字，直接告诉用户会跳到哪一天
    nextDayName() {
      return formatDayName(shiftDateString(this.currentDate, 1))
    },
    // 已经不在今天了才给「回到今天」。日期没有下限，「上一天」一直能翻，不用收起
    canGoToday() {
      return !!this.currentDate && this.currentDate !== this.todayString
    },
    // 模板里的书本：先是本学科的，再是公共的，合成一份列表省得模板里写两遍
    bookGroups() {
      const groups = []
      const push = (books) => {
        if (!books) return
        for (const [book, pages] of Object.entries(books)) groups.push({ book, pages })
      }
      push(this.templateData?.subjects?.[this.title]?.books)
      push(this.templateData?.commonSubject?.books)
      return groups
    },
    hasTemplates() {
      return this.bookGroups.length > 0 || !!(this.templateData?.actions?.length)
    },
    // 倒计条的动画时长跟定时器用同一个值，两边才不会差半拍
    closeCountdownStyle() {
      return { animationDuration: `${IDLE_CLOSE_DELAY}ms` }
    },
  },
watch: {
    async modelValue(newValue) {
      if (newValue) {
        this.drafts = {}
        this.initialDrafts = {}
        // 从面板出现那一刻开始算，读存档的耗时也算在这 5s 里
        this.startCloseCountdown()
        await this.loadContent(this.startDate)
        this.$nextTick(() => {
          this.focusInput()
          this.updateCurrentLine()
        })
        // 模板与正文无关，慢一点加载即可
        try {
          this.templateData = await dataProvider.loadData('classworks-config-homework-template')
        } catch (error) {
          console.error('Failed to load homework templates:', error)
          this.templateData = null
        }
      } else {
        this.stopCloseCountdown()
      }
    },
  },
  methods: {
    // 顶部倒计条：走满 5s 就自动关掉。倒计只从打开那一刻起算，
    // 面板里任何一点动静都会把它撤掉，此后不再自动关。
    // 条走完靠 CSS 动画，和这里的定时器同时起步，不会出现条没走完就关。
    startCloseCountdown() {
      this.stopCloseCountdown()
      this.countdownActive = true
      this._closeTimer = window.setTimeout(() => {
        this._closeTimer = 0
        this.countdownActive = false
        this.autoCloseOnIdle()
      }, IDLE_CLOSE_DELAY)
    },

    stopCloseCountdown() {
      if (this._closeTimer) window.clearTimeout(this._closeTimer)
      this._closeTimer = 0
      this.countdownActive = false
    },

    // 已经在倒计才需要撤，白名单外的按键（比如修饰键）也照样算数
    cancelCloseCountdown() {
      if (!this._closeTimer) return
      this.stopCloseCountdown()
    },

    // 倒计走完：正文被动过就不关，交给用户继续编辑
    autoCloseOnIdle() {
      if (this.changedDrafts().length) return
      this.handleClose()
    },

    // 切到某一天：没访问过就读存档存成草稿，访问过就直接用草稿
    async loadContent(dateString) {
      this.currentDate = dateString
      if (this.drafts[dateString] != null) return
      let content = ''
      try {
        const data = await dataProvider.loadData('classworks-data-' + dateString)
        if (data && data.success !== false) content = data.homework?.[this.title]?.content || ''
      } catch (error) {
        console.error('读取作业失败:', error)
      }
      this.initialDrafts[dateString] = content
      // 最后一行不是空行时，在文末补一个空行，方便接着写下一条
      this.drafts[dateString] = content === '' || content.endsWith('\n') ? content : content + '\n'
    },
    // 过去的日子也翻得动，所以两个方向都不设限
    shiftDate(offset) {
      this.goToDate(shiftDateString(this.currentDate, offset))
    },
    goToday() {
      if (this.currentDate === this.todayString) return
      this.goToDate(this.todayString)
    },
    selectDate(value) {
      const next = value instanceof Date ? toDateString(value) : value
      if (!/^\d{8}$/.test(next) || next === this.currentDate) return
      this.goToDate(next)
    },
    async goToDate(dateString) {
      await this.loadContent(dateString)
      this.$nextTick(() => {
        this.focusInput()
        this.updateCurrentLine()
      })
    },
    focusInput() {
      if (this.$refs.inputRef) this.$refs.inputRef.focus()
    },
    // 关闭判定统一走「按下—抬起」这一段手势，自己掌控，不依赖 Vuetify 的 click:outside
    // （浮层叠起来时它的 closeConditional 会因为 localTop 为 false 而永不触发）。
    // 面板内：只有落在空白处才关；面板外（遮罩）：轻点就关。
    handlePressStart(event) {
      if (!this.dialogVisible || event.button > 0) return
      // 多指触摸：只认第一根手指
      if (this._press && this._press.pointerId !== event.pointerId) return
      const content = this.dialogContent()
      this._press = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        inside: !!content?.contains(event.target),
        pickerOpen: this.pickerOpen,
      }
    },

    handlePressEnd(event) {
      const press = this._press
      this._press = null
      if (!this.dialogVisible || !press || press.pointerId !== event.pointerId) return
      // 触屏滚动：按下到抬起之间移动过就不是「点击」
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_SLOP) return
      // 这一下是专门用来收起日期选择器的（点在它外面），别顺带把面板也关了
      if (press.pickerOpen && !this.insideFloatingOverlay(event.clientX, event.clientY)) return
      if (this.nearInteractive(event.clientX, event.clientY)) return
      this.handleClose()
    },

    cancelPress() {
      this._press = null
    },

    // 对话框自己的内容容器：日期选择器虽然渲染在卡片内部，但属于另一个 .v-overlay__content。
    // v-dialog 的根是 Fragment，$el 拿不到元素，所以靠 content-class 定位。
    dialogContent() {
      return document.querySelector('.homework-dialog-content')
    },

    // 这一下落在日期选择器之类的浮层里吗（浮层渲染在卡片内部，但不是对话框自己的容器）。
    // 外面工具栏的选择器是另一个实例，各关各的。
    insideFloatingOverlay(x, y) {
      const ownContent = this.dialogContent()
      for (const el of document.elementsFromPoint(x, y) || []) {
        const overlay = el.closest?.('.v-overlay__content')
        if (overlay && overlay !== ownContent) return true
      }
      return false
    },

    // 这一下像是想点某个控件吗
    nearInteractive(x, y) {
      if (this.insideFloatingOverlay(x, y)) return true
      for (const el of document.elementsFromPoint(x, y) || []) {
        if (el.closest?.(INTERACTIVE_SELECTOR)) return true
      }
      // 手抖点偏了：附近 10px 内还有控件，也不关
      for (const el of document.querySelectorAll(INTERACTIVE_SELECTOR)) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        if (
          x >= rect.left - NEAR_PADDING &&
          x <= rect.right + NEAR_PADDING &&
          y >= rect.top - NEAR_PADDING &&
          y <= rect.bottom + NEAR_PADDING
        ) {
          return true
        }
      }
      return false
    },

    // Esc 与 Ctrl/Cmd+S 都当作「完成编辑」，和点空白一样走保存流程
    handleKeydown(event) {
      const isSave = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's'
      if (event.key !== 'Escape' && !isSave) return
      // 日期选择器开着时，Esc 只收选择器，面板留着继续编辑；
      // 选择器里的方向键、回车等不在这里处理，原样放给 Vuetify。
      if (this.pickerOpen && event.key === 'Escape') {
        this.pickerOpen = false
        event.stopPropagation()
        return
      }
      // Ctrl+S 默认会弹出浏览器的「保存网页」对话框，Esc 也别漏给 Vuetify 自己那套
      event.preventDefault()
      event.stopPropagation()
      this.handleClose()
    },
    getTextarea() {
      const ref = this.$refs.inputRef
      return ref ? ref.$el.querySelector('textarea') : null
    },
    // 关闭时把所有改动过的日期一起交回去，不只是当前看得见的那天
    handleClose() {
      const entries = this.changedDrafts()
      if (entries.length) this.$emit('save', entries)
      this.dialogVisible = false
    },
    // 改动过的日期：正文和读进来时不一致就算改过（首尾空白不算改动）
    changedDrafts() {
      const entries = []
      for (const dateString of Object.keys(this.drafts)) {
        const content = (this.drafts[dateString] || '').trim()
        if (content !== (this.initialDrafts[dateString] || '').trim()) {
          entries.push({ dateString, content })
        }
      }
      return entries
    },
    updateCurrentLine() {
      const textarea = this.getTextarea()
      if (!textarea) return
      const cursorPosition = textarea.selectionStart
      const content = this.content

      let currentPos = 0
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length
        const totalLength = currentPos + lineLength

        if (cursorPosition <= totalLength || i === lines.length - 1) {
          this.currentLine = lines[i]
          this.currentLineStart = currentPos
          this.currentLineEnd = totalLength
          break
        }

        currentPos = totalLength + 1 // +1 for the newline character
      }

      // 如果光标在文本末尾或内容为空
      if (!this.currentLine) {
        this.currentLine = ''
        this.currentLineStart = content.length
        this.currentLineEnd = content.length
      }
    },
    isBookSelected(book) {
      return this.currentLine.includes(book)
    },
    isPageSelected(book, page) {
      return this.currentLine.includes(page)
    },
    handleBookClick(book) {
      if (this.isBookSelected(book)) {
        // 删除包含该作业本的整行
        const lines = this.content.split('\n')
        const lineToDelete = lines.findIndex((line) => line.includes(book))
        if (lineToDelete !== -1) {
          lines.splice(lineToDelete, 1)
          this.content = lines.join('\n')
        }
      } else {
        // 在末尾插入新行
        const hasContent = this.content.trim().length > 0
        this.content = (hasContent ? this.content.trim() + '\n' : '') + book
      }
      this.$nextTick(() => {
        const textarea = this.getTextarea()
        if (!textarea) return
        textarea.focus()

        if (!this.isBookSelected(book)) {
          // 找到新插入的行的末尾位置
          const lines = this.content.split('\n')
          let position = 0
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(book)) {
              position += lines[i].length
              break
            }
            position += lines[i].length + 1 // +1 for newline
          }
          textarea.setSelectionRange(position, position)
        }
        this.updateCurrentLine()
      })
    },
    handlePageClick(book, page) {
      if (this.isPageSelected(book, page)) {
        // 删除当前行最后一处匹配的页码
        const start = this.currentLineStart
        const end = this.currentLineEnd
        const currentLineContent = this.content.slice(start, end)
        const lastIndex = currentLineContent.lastIndexOf(page)
        if (lastIndex !== -1) {
          const newLineContent =
            currentLineContent.slice(0, lastIndex) +
            currentLineContent.slice(lastIndex + page.length)
          this.content =
            this.content.slice(0, start) + newLineContent.trim() + this.content.slice(end)
        }
      } else {
        // 在当前行末尾插入
        const start = this.currentLineStart
        const end = this.currentLineEnd
        const currentLineContent = this.content.slice(start, end)
        this.content =
          this.content.slice(0, start) +
          currentLineContent.trim() +
          (currentLineContent.trim().length > 0 ? ' ' : '') +
          page +
          this.content.slice(end)
      }
      this.$nextTick(() => {
        const textarea = this.getTextarea()
        if (!textarea) return
        textarea.focus()

        // 将光标移动到当前行末尾
        const lines = this.content.split('\n')
        let position = 0
        for (let i = 0; i < lines.length; i++) {
          position += lines[i].length
          if (position > this.currentLineStart) {
            break
          }
          position += 1 // +1 for newline
        }
        textarea.setSelectionRange(position, position)
        this.updateCurrentLine()
      })
    },
    insertTemplate(text) {
      const textarea = this.getTextarea()
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      // 在快捷操作前添加空格
      const needsSpace =
        start > 0 && this.content[start - 1] !== ' ' && this.content[start - 1] !== '\n'
      this.content =
        this.content.slice(0, start) + (needsSpace ? ' ' : '') + text + this.content.slice(end)

      this.$nextTick(() => {
        textarea.focus()
        const newPosition = start + text.length + (needsSpace ? 1 : 0)
        textarea.setSelectionRange(newPosition, newPosition)
        this.updateCurrentLine()
      })
    },
    insertAtCursor(text) {
      if (!text) return

      const textarea = this.getTextarea()
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      this.content = this.content.slice(0, start) + text + this.content.slice(end)

      this.$nextTick(() => {
        textarea.focus()
        const newPosition = start + text.length
        textarea.setSelectionRange(newPosition, newPosition)
        this.updateCurrentLine()
      })
    },
    deleteLastChar() {
      const textarea = this.getTextarea()
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      if (start === end) {
        // 如果没有选中文本，删除光标前一个字符
        if (start > 0) {
          this.content = this.content.slice(0, start - 1) + this.content.slice(start)
          this.$nextTick(() => {
            textarea.focus()
            textarea.setSelectionRange(start - 1, start - 1)
            this.updateCurrentLine()
          })
        }
      } else {
        // 如果有选中文本，删除选中部分
        this.content = this.content.slice(0, start) + this.content.slice(end)
        this.$nextTick(() => {
          textarea.focus()
          textarea.setSelectionRange(start, start)
          this.updateCurrentLine()
        })
      }
    },
    // 从剪贴板读取内容并按光标位置组装新正文：有选中则替换，否则在光标处插入
    // 剪贴板完全为空时返回 null，空格或换行视为有效内容原样粘贴
    async buildContentWithPaste() {
      const text = await navigator.clipboard.readText()
      if (text == null || text === '') return null
      const textarea = this.getTextarea()
      if (!textarea) return null
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      return {
        content: this.content.slice(0, start) + text + this.content.slice(end),
        cursorPosition: start + text.length,
      }
    },
    // 从剪贴板粘贴，保留在对话框继续编辑
    async pasteFromClipboard() {
      try {
        const result = await this.buildContentWithPaste()
        if (!result) return
        this.content = result.content
        this.$nextTick(() => {
          const textarea = this.getTextarea()
          if (!textarea) return
          textarea.focus()
          textarea.setSelectionRange(result.cursorPosition, result.cursorPosition)
          this.updateCurrentLine()
        })
      } catch (error) {
        console.error('Failed to read clipboard:', error)
      }
    },
    // 从剪贴板粘贴并直接保存关闭
    async pasteAndComplete() {
      try {
        const result = await this.buildContentWithPaste()
        if (!result) return
        this.content = result.content
        this.$emit('save', [{ dateString: this.currentDate, content: this.content.trim() }])
        this.dialogVisible = false
      } catch (error) {
        console.error('Failed to read clipboard:', error)
      }
    },
  },
}
</script>

<style scoped>
/* 顶部倒计条：贴在卡片顶边的一条细线，5s 内不走完就自动关掉面板。
   颜色取 currentColor 再压到很低的透明度，深色下是浅灰、浅色下是深灰，不抢注意力 */
.close-countdown {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  overflow: hidden;
  /* 纯装饰，别挡住标题栏的点击 */
  pointer-events: none;
}

.close-countdown-bar {
  height: 100%;
  background: currentColor;
  opacity: 0.2;
  transform-origin: left center;
  animation-name: close-countdown-drain;
  animation-timing-function: linear;
  /* forwards：走完后停在空处，不会闪回满格 */
  animation-fill-mode: forwards;
}

/* 时长由 closeCountdownStyle 绑进来，和自动关闭用的是同一个值 */
@keyframes close-countdown-drain {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

/* 日期小标题：右侧放切换日期的按钮 */
.date-caption {
  display: flex;
  align-items: center;
  font-size: 0.8rem;
  opacity: 0.6;
  line-height: 1.5;
  margin-bottom: 4px;
}

/* 编辑框撑满左栏宽度；内部不出滚动条 */
.hw-area {
  --v-textarea-scroll-bar-width: 0;
  width: 100%;
}

.hw-area :deep(textarea) {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.hw-area :deep(textarea::-webkit-scrollbar) {
  display: none;
}

/* 粘贴按钮按整张卡片居中 */
.paste-bar {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}

.template-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.book-chip {
  align-self: flex-start;
}

.pages-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-left: 16px;
}

:deep(.v-chip) {
  cursor: pointer;
  user-select: none;
}

.quick-tools {
  border-left: none;
}

.quick-texts {
  gap: 4px;
}

.numeric-keypad {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
}

.keypad-row {
  display: flex;
  gap: 4px;
}

.keypad-btn {
  flex: 1;
  min-width: 36px !important;
}

.space-btn {
  width: 100% !important;
}
</style>
