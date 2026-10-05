<template>
  <v-dialog
    v-model="dialogVisible"
    :fullscreen="false"
    width="700"
    max-width="calc(100vw - 48px)"
    content-class="homework-dialog-content"
    persistent
  >
    <v-card border>
      <!-- 顶部倒计条：IDLE_CLOSE_DELAY 内一动不动就自动关掉，防的是误触打开 -->
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
              @click="scheduleCurrentLine"
              @keyup="updateCurrentLine"
              @input="updateCurrentLine"
              @mouseup="scheduleCurrentLine"
              @select="updateCurrentLine"
              @focus="inputFocused = true"
              @blur="inputFocused = false"
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

            <!-- 附加科目：点一下插入「# 附加科目名的作业」小节，光标落在小节里的新行 -->
            <div v-if="extraSubjects.length" class="extra-subjects mt-4">
              <div class="extra-subjects-caption">附加科目</div>
              <div class="d-flex flex-wrap ga-2 mt-1">
                <v-chip
                  v-for="name in extraSubjects"
                  :key="name"
                  color="primary"
                  size="small"
                  variant="flat"
                  @mousedown.prevent
                  @click="insertExtraSubject(name)"
                >
                  {{ name }}
                </v-chip>
              </div>
            </div>
          </div>

          <div class="quick-tools ml-4" style="min-width: 180px">
            <div class="numeric-keypad">
              <div class="keypad-row">
                <v-btn
                  v-for="n in 3"
                  :key="n"
                  class="keypad-btn"
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor(String(n + 0))"
                >
                  {{ n + 0 }}
                </v-btn>
              </div>
              <div class="keypad-row">
                <v-btn
                  v-for="n in 3"
                  :key="n"
                  class="keypad-btn"
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
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor(String(n + 6))"
                >
                  {{ n + 6 }}
                </v-btn>
              </div>
              <!-- 这行的两头按光标前面停在哪换，规则见 contextKeys 的注释表 -->
              <div class="keypad-row">
                <v-btn
                  class="keypad-btn"
                  size="small"
                  :class="{ 'key-blank': !padKeys[0] }"
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor(padKeys[0])"
                >
                  {{ padKeys[0] }}
                </v-btn>
                <v-btn
                  class="keypad-btn"
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor('0')"
                >
                  0
                </v-btn>
                <v-btn
                  class="keypad-btn"
                  size="small"
                  :class="{ 'key-blank': !padKeys[1] }"
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor(padKeys[1])"
                >
                  {{ padKeys[1] }}
                </v-btn>
              </div>
              <div class="keypad-row">
                <!-- 触发交给 v-repeat-click，所以这里只留 @mousedown.prevent 保住输入框的焦点 -->
                <v-btn
                  v-repeat-click="{ handler: deleteLastChar }"
                  class="keypad-btn"
                  color="error"
                  variant="tonal"
                  title="删除"
                  aria-label="删除"
                  @mousedown.prevent
                >
                  <!-- 图标放默认插槽里，不用 icon 属性：icon 会强制成圆形，和旁边的键位对不上 -->
                  <v-icon icon="mdi-backspace-outline" size="small" />
                </v-btn>
                <v-btn
                  class="keypad-btn keypad-word"
                  size="small"
                  :variant="canEndLine ? 'flat' : 'tonal'"
                  :color="canEndLine ? 'primary' : undefined"
                  @mousedown.prevent
                  @click="startNextItem"
                >
                  换行
                </v-btn>
                <v-btn
                  class="keypad-btn keypad-word"
                  size="small"
                  variant="tonal"
                  @mousedown.prevent
                  @click="insertAtCursor(' ')"
                >
                  空格
                </v-btn>
              </div>

              <!-- 量词。刚敲完一个数才出现，平时收起来不占地方 -->
              <div v-if="showBottomKeys" class="measure-row">
                <v-btn
                  v-for="key in bottomKeys"
                  :key="key"
                  class="measure-btn"
                  size="small"
                  variant="text"
                  @mousedown.prevent
                  @click="insertAtCursor(key)"
                >
                  {{ key }}
                </v-btn>
              </div>
            </div>
          </div>
        </div>
        <!-- 推荐面板：在编辑框和小键盘那一整行的下面，横着铺满卡片，右边缘和小键盘对齐。
             固定高度（.phrase-panel 写死了），写字时编辑框不会上下跳 -->
        <div class="phrase-panel">
          <div
            v-for="(row, ri) in panel"
            :key="ri"
            class="phrase-row"
            :class="{ 'phrase-row-affix': row.prefix || row.suffix }"
          >
            <!-- 「作为」「的作业」是固定文字，不是按钮 -->
            <span v-if="row.prefix" class="phrase-affix phrase-affix-prefix">{{ row.prefix }}</span>
            <div class="phrase-chips">
              <div v-for="(group, gi) in row.groups" :key="gi" class="phrase-group">
                <v-chip
                  v-for="chip in group"
                  :key="chipLabel(chip)"
                  class="ma-1 phrase-chip"
                  :variant="chipVariant(row, chip)"
                  :class="{ 'phrase-chip-on': isChipLit(row, chip) }"
                  @mousedown.prevent
                  @click="tapChip(chip, row)"
                >
                  {{ chipLabel(chip) }}
                </v-chip>
              </div>
            </div>
            <span v-if="row.suffix" class="phrase-affix phrase-affix-suffix">{{ row.suffix }}</span>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import dataProvider from '@/utils/dataProvider'
import { formatDayName, parseDateString, shiftDateString, toDateString } from '@/utils/date'
import {
  BOTTOM_KEYS,
  assembleDayContent,
  contextKeys,
  findDayBlockEnd,
  commonDayInSelection,
  mergeLinesInto,
  detachLineFromScope,
  selectionHeadings,
  headingAbove,
  ownerAt,
  headingAboveStart,
  headingBlockSize,
  headingTitleStart,
  hints,
  isHeadingLine,
  hasContent,
  lineAt,
  panelRows,
  pruneDayHeading,
  parseReserveLine,
  resolveReserveDay,
  parseReservations,
  reserveLine,
  retargetHeading,
  retargetDayHeading,
  retargetScopeHeading,
  applyDayToSelection,
  tidyBlankLines,
} from '@/utils/homeworkPhrases'

// 点在这些元素上（或紧贴着它们）都不算「点空白」，别关面板。
// 里面不能出现 .v-overlay__content：它是对话框自己的内容容器，整张卡片都在它里面。
const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="button"], .v-btn, .v-chip, .v-field, .v-list-item'
// 按下到抬起的位移超过这个值就当作滚动，不关面板
const TAP_SLOP = 10
// 离控件这么近以内也算点到了它
const NEAR_PADDING = 30
// 打开后 7s 内一动不动就自动关掉，防的是误触打开
const IDLE_CLOSE_DELAY = 7000
// 正文末尾留几个空行，方便接着写下一条。面板从「继续添加作业」卡片进来时会抬到 2
// （appendBlankLines），但那是「另起一份」的排版需求，只对正在编辑的那天成立
const DEFAULT_BLANK_LINES = 1

// 从 ownerStart 起删掉一整行。标题没了，它下面那段正文就露出来了——
// 上面要是还有个小标题，得空一行隔开，不然这段会被顺手收进那个标题里；
// 上面本来就是空的、或者本来就是正文，就不用隔（省一个没意义的空行）。
// 返回新正文，和并起来以后第一行的起始位置（放光标用）
function dropHeadingLine(content, ownerStart) {
  const ownerEnd = content.indexOf('\n', ownerStart)
  const end = ownerEnd < 0 ? content.length : ownerEnd
  const after = end < content.length ? end + 1 : content.length
  const head = content.slice(0, ownerStart).replace(/\n+$/, '')
  const rest = content.slice(after).replace(/^\n+/, '')
  // 标题删掉以后那段正文归谁管？要拿「删掉之后」的正文去问——在原文里问的话，
  // 问出来的正是那个正要删的标题自己，会误判成「归某个小标题管」
  const probe = head ? head + '\n' + rest : rest
  const governed = !!headingAbove(probe, head ? head.length + 1 : 0)
  const gap = !head ? '' : governed ? '\n\n' : '\n'
  return { text: tidyBlankLines(head + gap + rest), caretAt: (head + gap).length }
}

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
    // 正文末尾至少留几个空行，方便接着写下一条。
    // 普通入口 1；从「继续添加作业」卡片进来 2，好和已有内容隔开另起一份
    appendBlankLines: {
      type: Number,
      default: 1,
    },
    // 本科目的附加科目名称，给成一键插入「# 名字的作业」小节用
    extraSubjects: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['update:modelValue', 'save', 'preview'],
  data() {
    return {
      // 日期 -> 正文。翻到别的日期再翻回来时，这一天的改动还在，
      // 关闭时一次性把所有改动过的日期写回去
      drafts: {},
      // 读进来时的样子，用来判断哪些天被改过
      initialDrafts: {},
      currentDate: '',
      currentLine: '',
      currentLineStart: 0,
      currentLineEnd: 0,
      // 光标在这一行里的第几个字
      caretInLine: 0,
      // 多选的整行范围（{ start, end }），只选一行时是 null。
      // 放在 data 里跟着 updateCurrentLine 一起更新——computed 里读
      // selectionStart 既不响应又可能炸，面板得靠它知道自己是不是在改整块
      selectedRange: null,
      // 焦点在不在输入框里。不在的话小键盘一律不高亮
      inputFocused: false,
      pickerOpen: false,
      // 顶部倒计条是否在走，false 表示已经不需要倒计了
      countdownActive: false,
    }
  },
  created() {
    // 按下位置，不进响应式：只是用来判断这一下算不算「点击空白」
    this._press = null
    this._closeTimer = 0
    // 目标日的存档正文，日期 -> Promise。预览每敲一个字都要用，不能每次都去等
    // IndexedDB，所以连 Promise 一起存着，并发调用自然共用同一次读取
    this._baseCache = {}
    // 预览的世代号：读存档是异步的，回来时正文可能又变了，过期的那份直接扔掉
    this._previewToken = 0
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
    // 选区变化不一定都有 mouseup/click 配对（拖选中途、键盘扩选、还有原生工具）。
    // selectionchange 是唯一兜得住的口子——但页面上任何选区都触发它，
    // 所以只认焦点落在我们这个 textarea 上的情况
    document.addEventListener('selectionchange', this.onDocumentSelectionChange, true)
    // Esc / Ctrl+S 挂 document 捕获阶段，不挂卡片：点了卡片里不可聚焦的地方
    // （正文、推荐面板的空白）焦点会掉回 body，这时卡片上的 @keydown 收不到按键
    document.addEventListener('keydown', this.handleKeydown, true)
  },
  beforeUnmount() {
    document.removeEventListener('pointerdown', this.handlePressStart, true)
    document.removeEventListener('pointerup', this.handlePressEnd, true)
    document.removeEventListener('pointercancel', this.cancelPress, true)
    document.removeEventListener('pointerdown', this.cancelCloseCountdown, true)
    document.removeEventListener('keydown', this.cancelCloseCountdown, true)
    document.removeEventListener('wheel', this.cancelCloseCountdown, true)
    document.removeEventListener('selectionchange', this.onDocumentSelectionChange, true)
    document.removeEventListener('keydown', this.handleKeydown, true)
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
// 「的 xx」那个 xx 用光标所在那一节的小标题名。光标停在标题行上就用它自己，
    // 在正文里就是管着它的那一行标题；都没有就空着，面板退回「的作业」
    reserveScope() {
      if (isHeadingLine(this.currentLine)) return this.currentLine
      return headingAbove(this.content, this.currentLineStart)
    },
    // 面板的四行，哪一层都正好四行，高度才不变来变去。
    // 选中了多行就只给日期那一栏，点亮的是选区里那些标题解出来的那天
    panel() {
      const selection = this.selectedRange ? { day: this.selectionDay } : null
      return panelRows(
        this.currentLine,
        this.todayString,
        this.reserveScope,
        this.currentDate,
        selection,
      )
    },
    // 选区里那些标题解出来的是同一天就返回那天，不是就返回空串
    selectionDay() {
      if (!this.selectedRange) return ''
      return commonDayInSelection(
        this.content,
        this.selectedRange.start,
        this.selectedRange.end,
        this.todayString,
      )
    },
    bottomKeys() {
      return BOTTOM_KEYS
    },
    // 「~」「.」那两个格子按光标前面停在哪换，规则见 contextKeys 的注释表
    padKeys() {
      if (!this.inputFocused) return ['P', '第']
      return contextKeys(this.textBeforeCaret)
    },
    // 量词那一排（页 张 题 课 章）该不该出现：光标前面紧挨着一个阿拉伯数字就该出现。
    // 放 computed 不放 methods：模板里 v-if 写的是 showBottomKeys（不加括号），
    // 拿 methods 的话模板取到的是那个函数本身，永远为真，这一排就从来不隐藏
    showBottomKeys() {
      return this.inputFocused && hints(this.textBeforeCaret)
    },
    // 光标在这一行里的位置。放在 data 里跟着 updateCurrentLine 一起更新，
    // 不在 computed 里摸 DOM——渲染期读 selectionStart 既不响应，又可能炸掉整个面板
    textBeforeCaret() {
      return this.currentLine.slice(0, this.caretInLine)
    },
    // 换行只在「这一行真有内容」的时候才亮：光秃秃一个数字、或者只有标点，
    // 现在换行只会把没写完的东西切两半
    canEndLine() {
      return !!this.inputFocused && hasContent(this.currentLine)
    },
    // 倒计条的动画时长跟定时器用同一个值，两边才不会差半拍
    closeCountdownStyle() {
      return { animationDuration: `${IDLE_CLOSE_DELAY}ms` }
    },
  },
  watch: {
    // 正文一动就把预览推给展示板。存盘不归这里管——预览只是给外面看，
    // 真正写盘只发生在 handleClose
    drafts: {
      deep: true,
      handler() {
        this.pushPreview()
      },
    },
    async modelValue(newValue) {
      if (newValue) {
        this.drafts = {}
        this.initialDrafts = {}
        // 上一次编辑读过的存档作废：这段时间里存档可能已经被写过了
        this._baseCache = {}
        // 从面板出现那一刻开始算，读存档的耗时也算在这段倒计里
        this.startCloseCountdown()
        await this.loadContent(this.startDate)
        this.focusAndSync()
      } else {
        this.stopCloseCountdown()
      }
    },
  },
  methods: {
    // 顶部倒计条：打开后 IDLE_CLOSE_DELAY 内一动不动就自动关掉，防的是误触打开。
    // 倒计只从打开那一刻起算，面板里任何一点动静都会把它撤掉，此后不再自动关。
    // 撤掉的动作挂在 document 上，所以那之前必然已经被 keydown / pointerdown 撤过一次——
    // 也就是说真走到定时器这里时，正文一定是原样没动过的，撤了也不会丢东西。
    // 条走完靠 CSS 动画，和这里的定时器同时起步，不会出现条没走完就关。
    startCloseCountdown() {
      this.stopCloseCountdown()
      this.countdownActive = true
      this._closeTimer = window.setTimeout(() => {
        this._closeTimer = 0
        this.countdownActive = false
        this.handleClose()
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

    // 切到某一天：没访问过就读存档存成草稿，访问过就直接用草稿
    async loadContent(dateString) {
      this.currentDate = dateString
      if (this.drafts[dateString] != null) return
      const trimmed = (await this.ensureBase(dateString)).trim()
      this.initialDrafts[dateString] = trimmed
      this.drafts[dateString] = this.padTrailingBlankLines(trimmed)
    },
    // 正文末尾补足空行，已经够了就只补差额。空正文不动（没什么可隔开的）。
    // want 不传就是跟着面板的进入方式走；预定标记搬过去的目标日要另开一份，
    // 不该跟着那个入口走——传 DEFAULT_BLANK_LINES
    padTrailingBlankLines(content, want = this.appendBlankLines) {
      if (!content) return content
      const count = Math.max(0, want)
      const have = /(\n*)$/.exec(content)[1].length
      return have >= count ? content : content + '\n'.repeat(count - have)
    },

    // 追加一个附加科目小节：小标题独占一段，渲染层才认得出它是附加科目的作业。
    // 光标前已经有内容时先补一个空行当分隔，再另起一行写小标题，光标落在小标题下面那行
    insertExtraSubject(name) {
      const textarea = this.getTextarea()
      if (!textarea || !name) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const before = this.content.slice(0, start)
      let prefix = ''
      if (before) {
        if (!before.endsWith('\n')) prefix = '\n\n'
        else if (!before.endsWith('\n\n')) prefix = '\n'
      } else if (this.content.startsWith('#')) {
        // 光标在正文最开头，没有 before 可判断；但整段若本来就是以附加科目小节开头，
        // 新插入的小节照样得和它隔开
        prefix = '\n\n'
      }
      const text = prefix + `# ${name}\n`
      this.content = this.content.slice(0, start) + text + this.content.slice(end)
      this.$nextTick(() => this.restoreLineCaret(start + text.length))
    },

    // 过去的日子也翻得动，所以两个方向都不设限
    shiftDate(offset) {
      this.switchDate(shiftDateString(this.currentDate, offset))
    },
    goToday() {
      this.switchDate(this.todayString)
    },
    selectDate(value) {
      const next = value instanceof Date ? toDateString(value) : value
      if (!/^\d{8}$/.test(next) || next === this.currentDate) return
      this.switchDate(next)
    },
    // 翻日期也是一种「离开」，先把正文里的预定标记落实掉，
    // 不然跨页之后那些标记还留着，回头就找不着它原来管的那几行了。
    // 落实完就 goto 过去——搬走的内容已经进了 drafts，完成编辑时 changedDrafts
    // 会把当天和所有目标日一起交回去写盘，这里不用另外 emit
    async switchDate(dateString) {
      await this.settleReservations()
      await this.loadContent(dateString)
      this.focusAndSync()
    },
    // 输入框重新可用了才能定位光标，所以聚焦要等一拍
    focusAndSync() {
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
      // 触屏滚动：按下到抬起之间移动过就不是「点击」。
      // 只在卡片内这么算——卡片里滑动多半是想滚动或滚掉输入框的焦点，
      // 遮罩上没东西可滑，滑一下照样算「点了外面」，直接关
      if (press.inside && Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_SLOP) return
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

    // 日期选择器虽然渲染在卡片内部，但属于另一个 .v-overlay__content。
    // 外面工具栏的选择器是另一个实例，各关各的
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
      // 手抖点偏了：附近 NEAR_PADDING 内还有控件，也不关。只扫对话框内部——
      // 外面展示板上的卡片再密也不该拖住这个面板，合起来又是一次全文档遍历
      const own = this.dialogContent()
      for (const el of own?.querySelectorAll(INTERACTIVE_SELECTOR) || []) {
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

    // Esc 与 Ctrl/Cmd+S 都当作「完成编辑」，和点空白一样走保存流程。
    // 挂在 document 捕获阶段：焦点不在卡片里也照样收得到（见 mounted 里的说明）
    handleKeydown(event) {
      if (!this.dialogVisible) return
      const isSave = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's'
      if (event.key !== 'Escape' && !isSave) return
      // 日期选择器开着时，Esc 只收选择器，面板留着继续编辑；
      // 选择器里的方向键、回车等不在这里处理，原样放给 Vuetify
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
    // 关闭时把所有改动过的日期一起交回去，不只是当前看得见的那天。
    // 完成编辑这一刻顺便把正文里的「预定」标记落实掉：标记行以下的内容
    // 搬到那一天去，标记行本身不留，被搬进去的那几天也要一并交回去写盘
    async handleClose() {
      // 先落实预定。它把搬走的内容直接写进目标日的草稿，所以下面
      // changedDrafts 一次就把当天和所有目标日都算上了，不用再单独合并一遍。
      // 顺序反了的话 changedDrafts 拿到的还是没搬过的正文，标记行会被存回去
      await this.settleReservations()
      const entries = this.changedDrafts()
      if (entries.length) this.$emit('save', entries)
      this.dialogVisible = false
    },
    // 把手工写的预定标记落实到各个日期上，返回被搬进去的日期和它们的新正文。
    // 只在完成编辑和翻日期这一刻跑：展示和预览都另有自己的一份解析（buildPreviewPayload），
    // 不去动草稿，所以两者不会互相把对方算好的结果改掉
    async settleReservations() {
      const { blocks, rest } = parseReservations(this.content, this.todayString)
      if (!blocks.length) return []
      this.content = rest
      this.currentLine = ''
      this.currentLineStart = rest.length
      this.currentLineEnd = rest.length
      // 同一天可能被预定好几块，按正文里的先后依次追加，别打乱
      const byDate = new Map()
      for (const block of blocks) {
        if (!byDate.has(block.dateString)) byDate.set(block.dateString, [])
        byDate.get(block.dateString).push(block)
      }
      const entries = []
      for (const [dateString, list] of byDate) {
        // 空行统一理一遍，末尾按默认的一份留：appendBlankLines 管的是「这个面板怎么打开的」，
        // 从「继续添加作业」进来要 2 个是为了在正文末尾另起一份，
        // 跟往目标日追加一段没关系，跟着走就会凭空多出一个空行
        const content = this.padTrailingBlankLines(
          tidyBlankLines(assembleDayContent(await this.ensureBase(dateString), list)),
          DEFAULT_BLANK_LINES
        )
        // 草稿也得立刻跟上。少了这一步，这次编辑里再翻回那天，
        // loadContent 会因为 drafts 里已经有一份（旧的）就直接返回它，
        // 目标日期看到的还是搬过去之前的样子
        this.drafts[dateString] = content
        // 交回去写盘的去掉首尾空白，和 changedDrafts 同一个规矩
        entries.push({ dateString, content: content.trim() })
      }
      return entries
    },
    // 那天的底稿：这次编辑里翻到过就用草稿（别拿存档里旧的覆盖掉），没翻到过才读存档。
    // 读过的把 Promise 本身存下来——预览每敲一个字都要用，存 Promise 既省了重复打存档，
    // 也让并发调用天然共用同一次读取。readStoredDay 读不出来返回空串、不reject，
    // 所以下面那句 ??= 就够了
    async ensureBase(dateString) {
      if (this.drafts[dateString] != null) return this.drafts[dateString]
      this._baseCache[dateString] ??= this.readStoredDay(dateString)
      return this._baseCache[dateString]
    },
    // 存档里那天本子的正文。读进来先去掉首尾空白：存档里本来就该是干净的，
    // 但旧版本会把面板入口要求的空行一起写进去（见 settleReservations），
    // 在这儿理掉，末尾的空行才是我们自己按份数留的
    async readStoredDay(dateString) {
      try {
        const data = await dataProvider.loadData('classworks-data-' + dateString)
        if (data && data.success !== false) return (data.homework?.[this.title]?.content || '').trim()
      } catch (error) {
        console.error('读取作业失败:', error)
      }
      return ''
    },
    // 给展示板的实时预览：日期 -> 正文。每一份都把预定标记解析掉，
    // 搬走的内容拼到目标日那一节后面——和 settleReservations 用同一套拼法，
    // 区别只是结果不落进草稿。所以展示板上看到的是「将会变成什么样」，
    // 而不是已经存了什么
    async buildPreviewPayload() {
      const payload = {}
      // 标记可能来自任何一天，同一个目标日要把各处的块按正文里的先后并起来
      const byDate = new Map()
      for (const [dateString, draft] of Object.entries(this.drafts)) {
        const { blocks, rest } = parseReservations(draft || '', this.todayString)
        payload[dateString] = rest
        for (const block of blocks) {
          if (!byDate.has(block.dateString)) byDate.set(block.dateString, [])
          byDate.get(block.dateString).push(block)
        }
      }
      await Promise.all(
        [...byDate].map(async ([dateString, list]) => {
          const base = await this.ensureBase(dateString)
          payload[dateString] = this.padTrailingBlankLines(
            tidyBlankLines(assembleDayContent(base, list)),
            DEFAULT_BLANK_LINES
          )
        })
      )
      return payload
    },
    // 每敲一个字都推一次预览。等底稿的这几毫秒里正文可能又变了，
    // 过期的那一轮直接扔掉，交给新一轮
    async pushPreview() {
      const token = ++this._previewToken
      const payload = await this.buildPreviewPayload()
      if (token !== this._previewToken) return
      this.$emit('preview', payload)
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
      this.selectedRange = this.readSelectedRange()
      const caret = textarea.selectionStart
      const { text, start, end } = lineAt(this.content, caret)
      this.currentLine = text
      this.currentLineStart = start
      this.currentLineEnd = end
      this.caretInLine = Math.max(0, Math.min(caret - start, text.length))
    },
    // 选区变化不一定都有 mouseup/click 配对（拖选中途、键盘扩选、原生工具菜单）。
    // 只认焦点在我们这个 textarea 上的情况，页面上别的选区不管
    onDocumentSelectionChange() {
      if (!this.dialogVisible) return
      if (document.activeElement !== this.getTextarea()) return
      this.updateCurrentLine()
    },
    // 点落在选区内部时，浏览器把选区收掉比 mouseup/click 晚一拍，当场读到的还是
    // 旧选区——表现就是「点在选区内第一次没反应、要点第二下」。
    // 所以当场读一遍，再等这一拍过了补读一遍
    scheduleCurrentLine() {
      this.updateCurrentLine()
      clearTimeout(this._settleTimer)
      this._settleTimer = setTimeout(() => this.updateCurrentLine(), 0)
    },
    // 选中的多行，整行范围是 { start, end }；没选、或者只选了一行，都返回 null。
    // 只选一行不算多选——单行的走原来那套（#+单行直接改那个 #）
    readSelectedRange() {
      const textarea = this.getTextarea()
      if (!textarea) return null
      const { selectionStart: from, selectionEnd: to } = textarea
      if (from >= to) return null
      const content = this.content
      const start = content.lastIndexOf('\n', from - 1) + 1
      // 末行取「最后一个被选中的字符」那行。选区末尾正好落在下一行开头时，
      // 下一行一个字都没选中，就不能算进来——不然从行首拖到下一行行首
      // 会白捡一整行
      const nl = content.indexOf('\n', to - 1)
      const end = nl < 0 ? content.length : nl
      if (!content.slice(start, end).includes('\n')) return null
      return { start, end }
    },
    // 从 from 起数 count 行，最后一行末尾在哪儿
    lineRangeEnd(content, from, count) {
      let at = from
      for (let index = 1; index < count; index++) {
        const nl = content.indexOf('\n', at)
        if (nl < 0) return content.length
        at = nl + 1
      }
      const nl = content.indexOf('\n', at)
      return nl < 0 ? content.length : nl
    },

    // 按钮上显示的字。日期按钮是 { word, date }，别的按钮就是直接一个词
    chipLabel(chip) {
      return typeof chip === 'string' ? chip : chip.word
    },
    // 该亮的按钮垫一层，当选中。不是强调色——拿主题的文字色垫一层，深浅色都跟得住。
    // 光靠 variant="flat" 不够：浅色主题下那层底色几乎看不出来
    chipVariant(row, chip) {
      if (this.isChipLit(row, chip)) return 'flat'
      return row.reserve ? 'outlined' : 'text'
    },
    // 这个按钮是不是当前该亮的那个目标日期。按日期比不按字比——
    // 用户写「周三」，该亮的是写着「下周二」那个按钮
    isChipLit(row, chip) {
      return !!chip.date && !!row.lit?.includes(chip.date)
    },
    // 面板上点一个词：只往光标处写这几个字。
    // 「作为…的 xx」那一栏点的后果看光标在哪、有没有多选，在 chooseDay 里分派
    tapChip(chip, row) {
      const word = this.chipLabel(chip)
      if (row?.reserve) {
        this.chooseDay(word, chip.date)
        return
      }
      this.insertWord(word, row)
    },
    // 选了一个日期。点的是「正在编辑的那天」就把日期信息摘掉，点别的日子
    // 就加上/换成那天——正在编辑 10 月 10 号，那天就摘，其余日子都加上。
    // 走哪几条路看光标在哪、有没有多选：
    //   0. 选中了多行            → 整块一起改，只动落在选区里的那些 # 行
    //   1. 光标就在 # 行上        → 改的就是这个标题本身
    //   2. 上面没有小标题          → 老样子，把这一行挪到那天那一节
    //   3. 有小标题，但下面只有一行 → 直接改那个标题（不去新开一节）
    //   4. 有小标题，下面有多行    → 摘出这一行、复制标题改日期、保留空行
    // 走 3、4 之前都先找「那天已经有的那一节」并进去，别再开一个同名的。
    // 这一行本来就归那一天的话，mergeLinesInto 会挡下来，这里等于什么都不做
    chooseDay(day, date) {
      const textarea = this.getTextarea()
      if (!textarea) return
      const strip = date === this.currentDate
      if (this.selectedRange) {
        this.applySelectedDay(day, strip)
        return
      }
      if (isHeadingLine(this.currentLine)) {
        this.retitleHeading(day, strip)
        return
      }
      const ownerStart = headingAboveStart(this.content, this.currentLineStart)
      if (ownerStart < 0) {
        // 上面没有小标题，这一行本来就是这一天的正文。点当天不动它
        if (!strip) this.insertReservation(day)
        return
      }
      if (headingBlockSize(this.content, ownerStart) <= 1) {
        // 那天已经有这一节了就并进去，别再开一个同名的
        if (this.mergeSelectedLines(day, strip)) return
        this.retitleOwner(ownerStart, day, strip)
        return
      }
      // 点的是正在编辑的那天：这行本来就是当天的作业，不用挂标记，
      // 并进上面已有的那一节；上面什么都没有才退而求其次、只空行隔开。
      // 放在单行判断之后——只有一行的那种该删标题，由 retitleOwner 管
      if (strip) {
        const owner = headingAbove(this.content, this.currentLineStart)
        const ownerDate = resolveReserveDay(parseReserveLine(owner)?.word, this.todayString)
        if (!ownerDate || ownerDate === this.currentDate) return
        if (this.mergeSelectedLines(day, true)) return
        const result = detachLineFromScope(this.content, this.currentLineStart)
        this.content = result.text
        this.$nextTick(() => this.restoreLineCaret(result.caretAt))
        return
      }
      if (this.mergeSelectedLines(day, false)) return
      // 复制出来跟原来一模一样（本来就是那天的），动了等于没动
      const owner = headingAbove(this.content, this.currentLineStart)
      if (retargetHeading(owner, day) === owner) return
      this.insertReservation(day)
    },
    // 整块选区改日期。选区里有 # 行就只改那些 # 行（正文行、选区外的行、
    // 还有它们各自归着的标题，一个字符都不改）；一个 # 行都没有就整段新起一节
    applySelectedDay(word, strip) {
      const range = this.selectedRange
      if (!range) return
      const before = this.content
      // 选区跨了几段就一段一段改；先试并进那天已有的同名那一节
      const owner = ownerAt(before, range.start)
      const target = resolveReserveDay(word, this.todayString)
      // 这一片本来就归那一天：什么都不做。不挡的话拼回一样的字符串会被当成
      // 「没改动」，掉进兜底白白复制出一个同名的小标题
      if (owner && target) {
        const ownerDate = resolveReserveDay(parseReserveLine(owner)?.word, this.todayString)
        if (ownerDate === target) return
      }
      // 选区跨了好几节就别整块往一处并了——那是一段一段的事，交给下面那个。
      // 只有「就在一节里」才并：整节搬走并进那天同名的某一节，
      // 或者点编辑日时并进上面那个没有小标题的正文块
      const oneSection = selectionHeadings(before, range.start, range.end).every(
        (at) => at === range.start,
      )
      let result = oneSection
        ? mergeLinesInto(
            before,
            range.start,
            range.end,
            this.todayString,
            target || this.currentDate,
            strip,
          )
        : null
      if (!result) result = applyDayToSelection(before, range.start, range.end, word, strip)
      if (!result || result.text === before) return
      this.content = result.text
      this.$nextTick(() => {
        // 选区得留着，面板才继续停在「整块改」那一页。加了 # 行之后位置全变了，
        // 按动过的那块重新框，别拿旧偏移去框
        const textarea = this.getTextarea()
        if (!textarea) return
        textarea.setSelectionRange(
          result.blockStart,
          this.lineRangeEnd(this.content, result.blockStart, result.blockLines),
        )
        this.updateCurrentLine()
      })
    },
    // 把光标这一行并进那天已有的某一节，而不是新起一节。成功返回 true。
    // 没有可并的地方就返回 false，调用方照原样新起一节
    mergeSelectedLines(day, allowPlain) {
      const target = resolveReserveDay(day, this.todayString)
      if (!target) return false
      const merged = mergeLinesInto(this.content, this.currentLineStart, this.currentLineEnd, this.todayString, target, allowPlain)
      if (!merged) return false
      this.content = merged.text
      // 光标跟着挪过去的那一行走。行里的列号没变（那几行一个字都没动），
      // 用挪动后的行首加上原来的列号就行
      const caret = merged.blockStart + this.caretInLine
      this.$nextTick(() => this.restoreLineCaret(caret))
      return true
    },
    // 光标停在 # 行上：改的就是这个标题本身。
    // 光标跟着标题名走——在名字前面（# 明天的|通知）就还留在前面，
    // 在名字后面或者压根没名字（#|、# 通知|）就还留在后面，
    // 刚选完日期接着写名字，不用再手动挪回去
    // 这里只改这一行本身，不删：「#明天的作业」点编辑日 -> 「#作业」，# 得留着。
    // 真要删整行是「光标在它下面那一行」时的事（那一节被摘空了才删），见 retitleOwner
    retitleHeading(day, strip) {
      const textarea = this.getTextarea()
      if (!textarea) return
      const column = textarea.selectionStart - this.currentLineStart
      const offsetInName = column - headingTitleStart(this.currentLine)
      const next = retargetDayHeading(this.currentLine, day, strip)
      if (next === this.currentLine) return
      if (!next) {
        const dropped = dropHeadingLine(this.content, this.currentLineStart)
        this.content = dropped.text
        this.$nextTick(() => this.restoreLineCaret(dropped.caretAt))
        return
      }
      const caret = this.currentLineStart + headingTitleStart(next) + offsetInName
      this.content =
        this.content.slice(0, this.currentLineStart) + next + this.content.slice(this.currentLineEnd)
      this.$nextTick(() => this.restoreLineCaret(caret))
    },
    // 小标题下面只有光标这一行：直接改那个标题，不另开一节。光标仍停在正文那一行
    retitleOwner(ownerStart, day, strip) {
      const textarea = this.getTextarea()
      if (!textarea) return
      const column = textarea.selectionStart - this.currentLineStart
      const ownerEnd = this.content.indexOf('\n', ownerStart)
      const end = ownerEnd < 0 ? this.content.length : ownerEnd
      const owner = this.content.slice(ownerStart, end)
      const next = retargetScopeHeading(owner, day, strip)
      if (next === owner) return
      if (!next) {
        // 整行删掉，正文跟上面那一节并成一段。光标还在原来那一行上
        const dropped = dropHeadingLine(this.content, ownerStart)
        this.content = dropped.text
        this.$nextTick(() => this.restoreLineCaret(dropped.caretAt + column))
        return
      }
      this.content = this.content.slice(0, ownerStart) + next + this.content.slice(end)
      // 标题变长了，正文那一行跟着往后挪
      const caret = ownerStart + next.length + 1 + column
      this.$nextTick(() => this.restoreLineCaret(caret))
    },
    // 预定：把光标所在这一行摘下来，挪到那天「的作业」那一节的最后接着写。
    // 那天还没有这一节就在末尾新起一节；已经有了就接在已有内容后面。
    // 这一行原本被某个小标题管着的话，把那个标题也复制一份过去，
    // 是「某天的xx」就只把那天换掉、xx 保留。
    // 这里只挪位置——搬到哪天是完成编辑、或者翻日期时才解析的事
    insertReservation(day) {
      const textarea = this.getTextarea()
      if (!textarea) return
      const line = this.currentLine
      // 光标已经在标题行上了：再套一层标题只会把内容搞乱
      if (isHeadingLine(line)) return

      // 摘掉这一行，连带一个换行，不然原地会留下一个空行
      let cutStart = this.currentLineStart
      let cutEnd = this.currentLineEnd
      if (this.content[cutEnd] === '\n') cutEnd += 1
      else if (cutStart > 0 && this.content[cutStart - 1] === '\n') cutStart -= 1
      // 摘走之前先记住这一行原本是被哪个标题管着的
      const owner = headingAbove(this.content, cutStart)
      let rest = pruneDayHeading(
        this.content.slice(0, cutStart) + this.content.slice(cutEnd),
        cutStart,
      )

      // 新一节的标题：跟着原来那个标题走，只有「某天的xx」才跟（那天要换掉）；
      // 「# 通知」这种普通标题跟过去就是多一份一模一样的标题，还是用「xx的作业」
      const heading = (owner && retargetHeading(owner, day)) || reserveLine(day)

      // 空行统一交给 tidyBlankLines 理，手工写的标题行也一并按这个理。
      // 先理再算插入点：理完偏移才是准的。反过来算的话，原文里那几个多出来的
      // 空行一被收掉，位置全往前挪，光标就落到文末去了
      rest = tidyBlankLines(rest)
      const blockEnd = findDayBlockEnd(rest, day)
      let text = ''
      let caret = 0
      if (blockEnd >= 0) {
        // 已经有那一天的「的作业」：接在已有内容后面。
        // 那一节后面紧跟着的如果不是换行（标题是全文最后一行），
        // 得自己补一个，不然新行会粘在标题那一行上
        const glue = blockEnd > 0 && rest[blockEnd - 1] !== '\n' ? '\n' : ''
        text = rest.slice(0, blockEnd) + glue + line + '\n' + rest.slice(blockEnd)
        caret = blockEnd + glue.length + line.length
      } else {
        // 末尾新起一节。# 前面留一个空行就好，先把尾部换行抹平，
        // 不然正文末尾本来就有的空行会跟这个叠成两行。
        // 板上一条内容都没有也不补「今天的作业」——那节是空的，看着像真有事
        const body = rest.replace(/\n+$/, '')
        const head = body.trim() ? body + '\n\n' : ''
        text = head + heading + '\n' + line
        caret = text.length
      }
      // 插入本身可能造出新的空行（比如新标题前面那一个），所以最后再兜底理一遍
      text = tidyBlankLines(text)
      this.content = text
      this.$nextTick(() => this.restoreLineCaret(caret))
    },
    // 往光标处写一个按钮上的字。按钮上的字用户已经自己敲过一半时，只补剩下那几个
    // （已经打了「明天」再点「明天上课对答案」，就只补一个「上课对答案」），
    // 这种接着写完的情况前面不用再补逗号——不是在起一个新词
    insertWord(word, row) {
      const textarea = this.getTextarea()
      if (!textarea) return
      // 选区中就按替换处理，和手打一个字一样。不这么处理的话，选区时 currentLine
      // 是首行，这个词会写到首行去、而选区还挂在正文上，看着就是点了没反应，
      // 得再点一下才反应过来
      if (textarea.selectionStart !== textarea.selectionEnd) {
        this.insertAtCursor(word)
        return
      }
      const at = row?.endsLine ? this.currentLineEnd : textarea.selectionStart
      const typed = this.typedPrefix(this.content.slice(this.currentLineStart, at), word)
      const rest = typed ? word.slice(typed.length) : word
      // comma 那一排（收尾建议）是在已有内容后面接一句，所以先补一个逗号隔开。
      // 用户自己已经打了逗号、或者已经在接着写这个词，就只补剩下的，不再来一个逗号；
      // 逗号前面是换行（光标在这一行最开头）也不补，不然那一行会以逗号开头
      const tail = at > 0 ? this.content[at - 1] : ''
      const needsComma = !!row?.comma && !typed && !!tail && !/^[,，\n]$/.test(tail)
      const insert = (needsComma ? '，' : '') + rest + (row?.endsLine ? '\n' : '')
      // 自动换行是替用户做了一件事，说一声，不然光标莫名其妙跳到下一行
      if (row?.endsLine) this.$message.success('已换行', '这一条收尾了，接着写下一条')
      // 收尾那一排要写到行尾，不是光标处。挪光标会打断浏览器的撤销分组，
      // 所以那种情况老实走字符串拼接；其余（光标本来就在那儿）走原生通道
      if (at === textarea.selectionStart && this.insertNative(insert)) {
        this.updateCurrentLine()
        return
      }
      this.content = this.content.slice(0, at) + insert + this.content.slice(at)
      this.$nextTick(() => this.restoreLineCaret(at + insert.length))
    },
    // 光标前面已经敲进去的、又是这个词开头的，最长能对上几个字。
    // 整个词都敲进去了就不算补全——那属于「再要一个」，照常再加一遍
    typedPrefix(before, word) {
      if (before.endsWith(word)) return ''
      for (let len = Math.min(before.length, word.length - 1); len > 0; len--) {
        const prefix = word.slice(0, len)
        if (before.endsWith(prefix)) return prefix
      }
      return ''
    },
    // 手动换行：结束这一条，另起一行。光标落到空行上，面板自然回到第一层
    startNextItem() {
      const textarea = this.getTextarea()
      if (!textarea) return
      const at = this.currentLineEnd
      // 光标本来就在行尾的话走原生插入，换行也能被 ctrl+z 撤掉
      if (at === textarea.selectionStart && this.insertNative('\n')) {
        this.updateCurrentLine()
        return
      }
      this.content = this.content.slice(0, at) + '\n' + this.content.slice(at)
      this.$nextTick(() => this.restoreLineCaret(at + 1))
    },
    // 改完正文重新定位光标：聚焦 + 落到指定位置 + 把当前行刷新一遍。
    // DOM 要等 Vue 渲染完才能动，所以调用方一律包在 $nextTick 里
    restoreLineCaret(position) {
      const textarea = this.getTextarea()
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(position, position)
      this.updateCurrentLine()
    },
    // 尽量走浏览器自己的插入通道 insertText。它是往「当前光标/选区」插，
    // 浏览器会把它记进原生撤销栈，用户 ctrl+z 能撤掉；
    // 直接改 this.content 的话 v-model 一设 .value，撤销栈就被清空了。
    // 返回 false 表示这条路走不通，调用方退回字符串拼接（没有撤销，但行为一致）
    insertNative(text) {
      const textarea = this.getTextarea()
      if (!textarea || !text) return false
      if (document.activeElement !== textarea) return false
      // 有选区时等于替换选区。原生撤销能记这一下，但把选区替换掉的语义
      // 用户按 ctrl+z 未必预期得到，这种就别凑这个热闹了
      if (textarea.selectionStart !== textarea.selectionEnd) return false
      try {
        return document.execCommand('insertText', false, text)
      } catch (error) {
        return false
      }
    },
    insertAtCursor(text) {
      if (!text) return
      const textarea = this.getTextarea()
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      // 原生通道：DOM 已经被浏览器改好，input 事件同步把 content 跟上，
      // 光标也已经在插入内容后面，不用再手动挪
      if (this.insertNative(text)) {
        this.updateCurrentLine()
        return
      }
      this.content = this.content.slice(0, start) + text + this.content.slice(end)
      this.$nextTick(() => this.restoreLineCaret(start + text.length))
    },
    // 原生删除，跟 insertText 一个路子。返回 false 表示走不通，调用方退回字符串拼接
    deleteNative() {
      const textarea = this.getTextarea()
      if (!textarea) return false
      if (document.activeElement !== textarea) return false
      try {
        return document.execCommand('delete')
      } catch (error) {
        return false
      }
    },
    deleteLastChar() {
      const textarea = this.getTextarea()
      if (!textarea) return
      const { selectionStart: start, selectionEnd: end } = textarea
      // 没选中文本就删光标前面那一个字，已经贴在最开头就没什么可删的
      const from = start === end ? start - 1 : start
      if (from < 0) return
      if (this.deleteNative()) {
        this.updateCurrentLine()
        return
      }
      this.content = this.content.slice(0, from) + this.content.slice(end)
      this.$nextTick(() => this.restoreLineCaret(start === end ? from : start))
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
        this.$nextTick(() => this.restoreLineCaret(result.cursorPosition))
      } catch (error) {
        console.error('Failed to read clipboard:', error)
      }
    },
    // 从剪贴板粘贴并直接保存关闭。
    // 关闭走 handleClose，别自己 emit：本次编辑可能改到多天（比如翻到另一天改过），
    // 那些草稿也在 handleClose 的保存范围里，只交回今天会把别的改动丢掉
    async pasteAndComplete() {
      try {
        const result = await this.buildContentWithPaste()
        if (!result) return
        this.content = result.content
        this.handleClose()
      } catch (error) {
        console.error('Failed to read clipboard:', error)
      }
    },
  },
}
</script>

<style scoped>
/* 顶部倒计条：贴在卡片顶边的一条细线，倒计走完就自动关掉面板。
   颜色取 currentColor 再压到很低的透明度，深色下是浅灰、浅色下是深灰，不抢注意力 */
.close-countdown {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
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
  margin-bottom: 2px;
}

/* 编辑框撑满左栏宽度；内部不出滚动条 */
.hw-area {
  --v-textarea-scroll-bar-width: 0;
  width: 100%;
}

.hw-area :deep(textarea) {
  scrollbar-width: none;
  -ms-overflow-style: none;
  /* 面板在下面折行占掉不少高度，编辑框不能无限长：正文一长就顶出屏幕，
     推荐按钮全看不见了。封顶之后正文在框里滚。约四行 */
  max-height: 104px;
  overflow-y: auto;
}

.hw-area :deep(textarea::-webkit-scrollbar) {
  display: none;
}

/* 粘贴按钮按整张卡片居中 */
.paste-bar {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
}

/* 附加科目按钮区：小标题沿用日期小标题的外观 */
.extra-subjects-caption {
  font-size: 0.8rem;
  opacity: 0.6;
  line-height: 1.5;
}

/* 推荐面板：在编辑框和小键盘那一整行的下面，横着铺满卡片，右边缘和小键盘对齐。
   高度写死，编辑框就不会被面板顶得上下跳。三行 × 一行 chip 的高度 + 两个间隙，
   刚好装下，不做滚动区——自己滚起来看着像坏了 */
.phrase-panel {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  width: 100%;
  height: 168px;
  gap: 2px;
  margin-top: 4px;
}

.phrase-row {
  display: flex;
  align-items: flex-start;
  align-self: stretch;
  width: 100%;
  min-width: 0;
  flex: 0 0 auto;
}

.phrase-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
}

/* 一组词。组只是折行的单位，不表示分组——所有按钮的间距一样，靠 chip 自己的 ma-1。
   组内自己也折行，「明天上课对答案」这种长句才不会被挤出面板 */
.phrase-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

/* 有前缀/后缀文字的那一行（「作为 … 的作业」）：词只占它自己那么宽，
   后缀紧跟在词后面，不推到行的最右边去 */
.phrase-row-affix .phrase-chips {
  flex: 0 1 auto;
}

/* 「作为」「的作业」这类固定文字，不是按钮 */
.phrase-affix {
  flex: 0 0 auto;
  align-self: center;
  padding: 0 2px;
  font-size: 0.85rem;
  line-height: 1.5;
  opacity: 0.7;
}

/* 前缀（「作为」）要和上面两行的按钮左对齐。按钮那个字的起点是 ma-1 的
   4px 外边距加 chip 默认档左右各 12px 的内边距，这里让出同样的一截 */
.phrase-affix-prefix {
  margin-left: 4px;
  padding-left: 12px;
}

:deep(.v-chip) {
  cursor: pointer;
  user-select: none;
}

/* 键位之间的间距，横竖一律用这一个值：行与行靠 .numeric-keypad 的 gap，
   一行之内靠各网格自己的 gap，两者都取它，不会一处宽一处窄 */
.quick-tools {
  --key-gap: 4px;
  border-left: none;
  display: flex;
  flex-direction: column;
}

.numeric-keypad {
  display: flex;
  flex-direction: column;
  gap: var(--key-gap);
}

/* 小键盘整列：每一行都是同一个三列网格，按钮尺寸只由网格决定，
   所以没有任何按钮自带宽度 */
.keypad-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--key-gap);
}

.keypad-btn {
  width: 100%;
  min-width: 0;
}

/* 换行、空格：两个汉字挤在数字键那么宽的一格里，字号比数字键小一号才匀。
   size="small" 本来就是 0.75rem，这里写死是免得改尺寸时跟着一起变 */
.keypad-word {
  font-size: 0.75rem;
}

/* 这一格这次不给东西（比如刚敲完 p、接下来该敲数字）。
   用 visibility 而不是 v-if，网格的位置要留着，不然 0 会往左边挪一格 */
.key-blank {
  visibility: hidden;
}

/* 量词那一排。五个键对不上三列，所以自己一行、均分整行，
   硬凑进上面那个网格只会让键宽一会儿宽一会儿窄 */
.measure-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--key-gap);
}

/* 量词上的字跟自动建议区的 chip 一样大（chip 默认档是 0.875rem，
   v-btn 按 size="small" 把它压到 0.75rem，这里改回来，两个区域看齐）。
   五个键分那一百八十来 px，一格三十几，v-btn 默认左右各 12px 的内边距
   会把字挤出去，所以一并收窄 */
.measure-btn {
  width: 100%;
  min-width: 0;
  padding: 0 2px;
  font-size: 0.875rem;
}
</style>

