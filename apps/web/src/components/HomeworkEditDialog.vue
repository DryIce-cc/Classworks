<!-- 作业编辑对话框：上半部分是当天，下半部分是未来某天（可切换日期） -->
<template>
  <v-dialog
    v-model="dialogVisible"
    :fullscreen="false"
    max-width="900"
    width="auto"
    @click:outside="handleClose"
  >
    <v-card border class="hw-dialog">
      <v-card-title class="d-flex align-center">
        {{ title }}
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" @click="handleClose" />
      </v-card-title>

      <!-- 滚动区只放两个编辑框和日期控件，右侧快捷键盘与下方工具栏都不参与滚动 -->
      <div class="editor-row">
        <v-card-text class="dialog-body">
          <div class="date-caption">{{ dayName(primaryDate) }}的作业</div>
          <v-textarea
            ref="primaryRef"
            :model-value="drafts[primaryDate]"
            auto-grow
            placeholder="使用换行表示分条"
            rows="5"
            :width="'480'"
            class="hw-area"
            @update:model-value="setDraft(primaryDate, $event)"
            @update:focused="onSideFocused('primary', $event)"
            @click="updateCurrentLine"
            @keyup="updateCurrentLine"
          />

          <template v-if="allowFuture">
            <div class="date-caption mt-3">
              {{ dayName(secondaryDate) }}的作业
              <v-spacer />
              <v-btn
                icon="mdi-chevron-left"
                size="small"
                variant="text"
                title="查看昨天"
                :disabled="!canStepSecondary(-1)"
                @click="stepSecondary(-1)"
              />
              <v-menu location="bottom">
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
                    :model-value="secondaryDateObj"
                    :min="minSecondaryObj"
                    color="primary"
                    @update:model-value="selectSecondaryDate"
                  />
                </v-card>
              </v-menu>
              <v-btn
                icon="mdi-chevron-right"
                size="small"
                variant="text"
                title="查看明天"
                @click="stepSecondary(1)"
              />
            </div>
            <v-textarea
              ref="secondaryRef"
              :model-value="drafts[secondaryDate]"
              auto-grow
              placeholder="使用换行表示分条"
              rows="2"
              :width="'480'"
              class="hw-area"
              @update:model-value="setDraft(secondaryDate, $event)"
              @update:focused="onSideFocused('secondary', $event)"
              @click="updateCurrentLine"
              @keyup="updateCurrentLine"
            />
          </template>
        </v-card-text>

        <!-- Quick Tools Section -->
        <div v-if="showQuickTools" class="quick-tools ml-4" style="min-width: 180px">
          <!-- Numeric Keypad -->
          <div class="numeric-keypad mb-4">
            <div class="keypad-row">
              <v-btn
                v-for="n in 3"
                :key="n"
                class="keypad-btn"
                size="small"
                variant="tonal"
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
                @click="insertAtCursor(String(n + 6))"
              >
                {{ n + 6 }}
              </v-btn>
            </div>
            <div class="keypad-row">
              <v-btn class="keypad-btn" size="small" variant="tonal" @click="insertAtCursor('-')">
                -
              </v-btn>
              <v-btn class="keypad-btn" size="small" variant="tonal" @click="insertAtCursor('0')">
                0
              </v-btn>
              <v-btn
                class="keypad-btn"
                color="error"
                size="small"
                variant="tonal"
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
                @click="insertAtCursor(' ')"
              >
                空格
              </v-btn>
              <v-btn
                class="keypad-btn space-btn"
                size="small"
                variant="tonal"
                @click="insertAtCursor('\n')"
              >
                换行
              </v-btn>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-1">
            <v-btn
              v-for="text in quickTexts"
              :key="text"
              size="small"
              variant="flat"
              @click="insertAtCursor(text)"
            >
              {{ text }}
            </v-btn>
          </div>
        </div>
        </div>

      <!-- 粘贴与模板固定在滚动区之外，滚动到哪个编辑框都能用 -->
      <v-card-text class="tool-bar">
        <div class="paste-bar">
          <v-btn size="small" variant="outlined" prepend-icon="mdi-content-paste" @click="pasteFromClipboard">
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
            <!-- Subject specific books -->
            <template v-if="subjectBooks">
              <div v-for="(pages, book) in subjectBooks" :key="book" class="button-group">
                <v-chip
                  :color="isBookSelected(book) ? 'success' : 'default'"
                  :variant="isBookSelected(book) ? 'elevated' : 'flat'"
                  class="ma-1 book-chip"
                  @click="handleBookClick(book)"
                >
                  {{ book }}
                </v-chip>

                <!-- Show pages only if book is selected -->
                <div v-if="isBookSelected(book)" class="pages-container mt-2">
                  <v-chip
                    v-for="page in pages"
                    :key="page"
                    :color="isPageSelected(book, page) ? 'info' : 'default'"
                    :variant="isPageSelected(book, page) ? 'elevated' : 'flat'"
                    class="ma-1"
                    @click="handlePageClick(book, page)"
                  >
                    {{ page }}
                  </v-chip>
                </div>
              </div>
            </template>

            <!-- Common books -->
            <template v-if="commonBooks">
              <div v-for="(pages, book) in commonBooks" :key="book" class="button-group">
                <v-chip
                  :color="isBookSelected(book) ? 'success' : 'default'"
                  :variant="isBookSelected(book) ? 'elevated' : 'flat'"
                  class="ma-1 book-chip"
                  @click="handleBookClick(book)"
                >
                  {{ book }}
                </v-chip>

                <!-- Show pages only if book is selected -->
                <div v-if="isBookSelected(book)" class="pages-container mt-2">
                  <v-chip
                    v-for="page in pages"
                    :key="page"
                    :color="isPageSelected(book, page) ? 'info' : 'default'"
                    :variant="isPageSelected(book, page) ? 'elevated' : 'flat'"
                    class="ma-1"
                    @click="handlePageClick(book, page)"
                  >
                    {{ page }}
                  </v-chip>
                </div>
              </div>
            </template>

            <!-- Actions -->
            <div v-if="templateData.actions?.length" class="button-group">
              <v-chip
                v-for="action in templateData.actions"
                :key="action"
                class="ma-1"
                color="primary"
                variant="flat"
                @click="insertTemplate(action)"
              >
                {{ action }}
              </v-chip>
            </div>
          </div>
          <div v-else class="text-center text-body-2 text-disabled mt-2">暂无可用的模板</div>
        </div>
      </v-card-text>

      <div class="text-center text-body-2 text-disabled mb-5">点击空白处完成编辑</div>
    </v-card>
  </v-dialog>
</template>

<script>
import dataProvider from '@/utils/dataProvider'
import { formatDayName, parseDateString, shiftDateString, toDateString } from '@/utils/date'

export default {
  name: 'HomeworkEditDialog',
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    initialContent: {
      type: String,
      default: '',
    },
    currentDateString: {
      type: String,
      default: '',
    },
    // 存储用的条目 key：一般就是科目名，没有单独传时退回标题
    subjectKey: {
      type: String,
      default: '',
    },
    // 后续日期的作业，形如 [{ dateString, homework }]，按日期升序
    futureDays: {
      type: Array,
      default: () => [],
    },
    // 只有当天视图才装载了后续日期的作业，查看其他日期时不能编辑未来
    allowFuture: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'save'],
  data() {
    return {
      // 日期 -> 正文，切换日期时保留草稿
      drafts: {},
      initialDrafts: {},
      primaryDate: '',
      secondaryDate: '',
      // 决定粘贴、模板、快捷键盘作用于哪个编辑框
      focusedSide: 'primary',
      templateData: null,
      currentLine: '',
      currentLineStart: 0,
      currentLineEnd: 0,
      quickTexts: ['课', '题', '例', '变', 'T', 'P'],
    }
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
    subject() {
      // 标题直接就是科目名称
      return this.title
    },
    storageKey() {
      return this.subjectKey || this.title
    },
    // 当前聚焦编辑框的日期
    activeDate() {
      return this.focusedSide === 'primary' ? this.primaryDate : this.secondaryDate
    },
    // 模板、粘贴、快捷键盘都走这一个入口，作用在聚焦的编辑框上
    content: {
      get() {
        return this.drafts[this.activeDate] || ''
      },
      set(value) {
        this.drafts[this.activeDate] = value
      },
    },
    secondaryDateObj() {
      return parseDateString(this.secondaryDate)
    },
    // 未来编辑框不能回到当天，否则和上面的编辑框冲突
    minSecondaryDate() {
      return shiftDateString(this.primaryDate, 1)
    },
    minSecondaryObj() {
      return parseDateString(this.minSecondaryDate)
    },
    hasTemplates() {
      return !!(this.templateData?.actions?.length || this.subjectBooks || this.commonBooks)
    },
    subjectBooks() {
      if (!this.subject || !this.templateData?.subjects?.[this.subject]?.books) {
        return null
      }
      return this.templateData.subjects[this.subject].books
    },
    commonBooks() {
      if (!this.templateData?.commonSubject?.books) {
        return null
      }
      return this.templateData.commonSubject.books
    },
    showQuickTools() {
      // 快捷键盘一律显示
      return true
    },
  },
  watch: {
    async modelValue(newValue) {
      if (newValue) {
        this.primaryDate = this.currentDateString || toDateString(new Date())
        const minDate = this.minSecondaryDate
        const drafts = {}
        // 当天内容为初始内容；最后一行不是空行时，在文末加一个空行
        const initial = this.initialContent || ''
        drafts[this.primaryDate] = initial === '' || initial.endsWith('\n') ? initial : initial + '\n'
        // 后续日期已填的作业一并载入草稿，默认停在最后一个有内容的那天
        let lastFilled = ''
        for (const day of this.futureDays || []) {
          if (day.dateString < minDate) continue
          const content = day.homework?.[this.storageKey]?.content
          if (!content) continue
          drafts[day.dateString] = content
          lastFilled = day.dateString
        }
        this.secondaryDate = lastFilled || minDate
        if (drafts[this.secondaryDate] == null) drafts[this.secondaryDate] = ''
        this.drafts = drafts
        this.initialDrafts = { ...drafts }
        this.focusedSide = 'primary'
        // 加载模板数据
        try {
          this.templateData = await dataProvider.loadData('classworks-config-homework-template')
        } catch (error) {
          console.error('Failed to load homework templates:', error)
          this.templateData = null
        }
        this.$nextTick(() => {
          this.focusActiveArea()
          this.updateCurrentLine()
        })
      }
    },
  },
  methods: {
    dayName(dateString) {
      return formatDayName(dateString)
    },
    setDraft(dateString, value) {
      this.drafts[dateString] = value
    },
    // 失焦不清空，最后点过的编辑框继续接收粘贴、模板和快捷键盘
    onSideFocused(side, focused) {
      if (focused) this.focusedSide = side
    },
    canStepSecondary(offset) {
      return shiftDateString(this.secondaryDate, offset) >= this.minSecondaryDate
    },
    stepSecondary(offset) {
      if (!this.canStepSecondary(offset)) return
      this.selectSecondaryDate(shiftDateString(this.secondaryDate, offset))
    },
    selectSecondaryDate(value) {
      const next = value instanceof Date ? toDateString(value) : value
      if (!next || next < this.minSecondaryDate) return
      this.secondaryDate = next
      // 新日期还没有草稿，先占位，免得输入内容被丢弃
      if (this.drafts[next] == null) this.drafts[next] = ''
      this.$nextTick(() => {
        this.focusedSide = 'secondary'
        this.focusActiveArea()
        this.updateCurrentLine()
      })
    },
    activeRef() {
      return this.focusedSide === 'primary' ? this.$refs.primaryRef : this.$refs.secondaryRef
    },
    activeTextarea() {
      const ref = this.activeRef()
      return ref ? ref.$el.querySelector('textarea') : null
    },
    focusActiveArea() {
      const ref = this.activeRef()
      if (ref && ref.focus) ref.focus()
    },
    // 收集所有改动过的日期
    collectChangedEntries() {
      const entries = []
      for (const dateString of Object.keys(this.drafts)) {
        const content = (this.drafts[dateString] || '').trim()
        if (content !== (this.initialDrafts[dateString] || '').trim()) {
          entries.push({ dateString, content })
        }
      }
      return entries
    },
    handleClose() {
      const entries = this.collectChangedEntries()
      if (entries.length) this.$emit('save', entries)
      this.dialogVisible = false
    },
    updateCurrentLine() {
      const textarea = this.activeTextarea()
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
        const textarea = this.activeTextarea()
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
        const textarea = this.activeTextarea()
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
      const textarea = this.activeTextarea()
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

      const textarea = this.activeTextarea()
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
      const textarea = this.activeTextarea()
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
      const textarea = this.activeTextarea()
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
          const textarea = this.activeTextarea()
          if (!textarea) return
          textarea.focus()
          textarea.setSelectionRange(result.cursorPosition, result.cursorPosition)
          this.updateCurrentLine()
        })
      } catch (error) {
        console.error('Failed to read clipboard:', error)
      }
    },
    // 从剪贴板粘贴并直接保存关闭；只保存当前聚焦的那个编辑框
    async pasteAndComplete() {
      try {
        const result = await this.buildContentWithPaste()
        if (!result) return
        this.content = result.content
        this.$emit('save', [{ dateString: this.activeDate, content: this.content.trim() }])
        this.dialogVisible = false
      } catch (error) {
        console.error('Failed to read clipboard:', error)
      }
    },
  },
}
</script>

<style scoped>
/* 卡片整体限高，超出时由中间的编辑区滚动，粘贴与模板始终留在视野内 */
.hw-dialog {
  display: flex;
  flex-direction: column;
  max-height: 92vh;
}

/* 左边编辑区滚动，右边快捷键盘原地不动 */
.editor-row {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.dialog-body {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.quick-tools {
  flex: 0 0 auto;
  overflow: hidden;
}

.tool-bar {
  flex: 0 0 auto;
  max-height: 30vh;
  overflow-y: auto;
}

/* 粘贴按钮按整张卡片居中，不跟着上面的两栏走 */
.paste-bar {
  display: flex;
  justify-content: center;
  gap: 8px;
}

/* 日期小标题：后一个编辑框右侧放切换日期的按钮 */
.date-caption {
  display: flex;
  align-items: center;
  font-size: 0.8rem;
  opacity: 0.6;
  line-height: 1.5;
  margin-bottom: 4px;
}

/* 编辑框内部不出滚动条，滚动统一交给外面的编辑区 */
.hw-area {
  --v-textarea-scroll-bar-width: 0;
}

.hw-area :deep(textarea) {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.hw-area :deep(textarea::-webkit-scrollbar) {
  display: none;
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

.group-label {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.6);
  margin-right: 8px;
  white-space: nowrap;
}

:deep(.v-chip) {
  cursor: pointer;
  user-select: none;
}

.quick-tools {
  border-left: 1px solid rgba(0, 0, 0, 0.12);
  padding-left: 16px;
}

.gap-1 {
  gap: 4px;
}

.numeric-keypad {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
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
