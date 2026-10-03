<template>
  <settings-card :loading="loading" border icon="mdi-book-multiple" title="科目管理">
    <div class="d-flex justify-space-between align-center mb-6">
      <div>
        <v-btn
          :loading="loading"
          class="mr-2"
          color="primary"
          prepend-icon="mdi-refresh"
          size="large"
          variant="text"
          @click="loadConfig"
        >
          重新加载
        </v-btn>

        <v-btn
          :loading="loading"
          color="success"
          prepend-icon="mdi-content-save"
          size="large"
          @click="saveConfig"
        >
          保存
        </v-btn>
        <v-btn
          :loading="loading"
          class="mr-2"
          prepend-icon="mdi-restore"
          variant="text"
          @click="resetToDefault"
        >
          重置为默认
        </v-btn>
      </div>
      <v-chip v-if="hasChanges" color="warning" variant="elevated"> 有未保存的更改 </v-chip>
    </div>

    <!-- 添加新科目 -->
    <v-card class="mb-4" variant="outlined">
      <v-card-text>
        <v-row>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="newSubjectName"
              :rules="[(v) => !!v || '科目名称不能为空']"
              append-inner-icon="mdi-plus"
              density="comfortable"
              label="科目名称"
              variant="outlined"
              @keyup.enter="addSubject"
              @click:append-inner="addSubject"
            />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- 科目列表 -->
    <v-card variant="outlined">
      <v-card-text class="pa-0">
        <v-list lines="one">
          <v-list-item v-for="(subject, index) in subjects" :key="subject.order">
            <template #prepend>
              <div class="d-flex flex-column align-center mr-2">
                <v-btn
                  :disabled="index === 0"
                  icon="mdi-chevron-up"
                  size="small"
                  variant="text"
                  @click="moveSubject(index, -1)"
                />
                <v-btn
                  :disabled="index === subjects.length - 1"
                  icon="mdi-chevron-down"
                  size="small"
                  variant="text"
                  @click="moveSubject(index, 1)"
                />
              </div>
            </template>

            <v-list-item-title>
              <v-text-field
                v-model="subject.name"
                density="compact"
                hide-details
                variant="plain"
                @blur="updateSubject(subject)"
              />
            </v-list-item-title>

            <template #append>
              <v-btn
                :icon="isExpanded(subject) ? 'mdi-chevron-up' : 'mdi-tune-variant'"
                size="small"
                title="附加属性"
                variant="text"
                @click="toggleExpand(subject)"
              />
              <v-btn
                color="error"
                icon="mdi-delete"
                size="small"
                variant="text"
                @click="deleteSubject(subject)"
              />
            </template>

            <!-- 附加属性：点右侧的调节图标展开 -->
            <v-expand-transition>
              <div v-if="isExpanded(subject)" class="subject-extras">
                <v-switch
                  v-model="subject.multiHomework"
                  color="primary"
                  density="compact"
                  hide-details
                  label="启用多份作业：底部常驻「继续添加作业」卡片，从那里进来时正文末尾留两个空行"
                />
                <div class="text-caption text-medium-emphasis mt-3 mb-1">附加科目名称</div>
                <div class="text-caption text-medium-emphasis mb-2">
                  填了之后，编辑面板里会出现一键按钮，往本科目下追加「# 附加科目名的作业」小节
                </div>
                <v-text-field
                  v-model="newExtraSubject"
                  density="compact"
                  hide-details
                  placeholder="输入附加科目名称后回车，如：历史（合格班）"
                  variant="outlined"
                  @keyup.enter="addExtraSubject(subject)"
                />
                <div v-if="subject.extraSubjects.length" class="d-flex flex-wrap ga-2 mt-3">
                  <v-chip
                    v-for="name in subject.extraSubjects"
                    :key="name"
                    closable
                    size="small"
                    @click:close="removeExtraSubject(subject, name)"
                  >
                    {{ name }}
                  </v-chip>
                </div>
              </div>
            </v-expand-transition>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- 底部提示 -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </settings-card>
</template>

<script>
import SettingsCard from '@/components/SettingsCard.vue'
import dataProvider from '@/utils/dataProvider.js'
import { cloneDefaultSubjects, normalizeSubjects } from '@/utils/subjects.js'

export default {
  name: 'SubjectManagementCard',

  components: {
    SettingsCard,
  },

  data() {
    return {
      loading: false,
      subjects: [],
      originalSubjects: null,
      newSubjectName: '',
      // 展开附加属性的科目：order 作键，和列表的 v-for 一样
      expandedOrder: null,
      // 正在给哪个科目录入附加科目名
      newExtraSubject: '',
      showSnackbar: false,
      snackbarText: '',
      snackbarColor: 'success',
    }
  },

  computed: {
    hasChanges() {
      return (
        this.originalSubjects &&
        JSON.stringify(this.subjects) !== JSON.stringify(this.originalSubjects)
      )
    },
  },

  created() {
    this.loadConfig()
  },

  methods: {
    isExpanded(subject) {
      return this.expandedOrder === subject.order
    },

    toggleExpand(subject) {
      this.expandedOrder = this.isExpanded(subject) ? null : subject.order
    },

    async loadConfig() {
      this.loading = true
      try {
        const response = await dataProvider.loadData('classworks-config-subject')
        // 读不到 key 时 dataProvider 会返回 { success: false }，必须判 success 而不是判真值
        if (response.success === false) {
          this.subjects = cloneDefaultSubjects()
          this.originalSubjects = JSON.parse(JSON.stringify(this.subjects))
          this.showMessage('使用默认配置', 'info')
          return
        }
        // 规整顺带补齐附加属性：旧存档里没有的字段在这里长出来，不会被读丢
        this.subjects = normalizeSubjects(response)
        this.originalSubjects = JSON.parse(JSON.stringify(this.subjects))
        this.showMessage('配置已加载', 'success')
      } catch (error) {
        console.error('Failed to load config:', error)
        this.showMessage('加载失败，可继续编辑当前配置', 'warning')
      }
      this.loading = false
    },

    async saveConfig() {
      this.loading = true
      try {
        const response = await dataProvider.saveData('classworks-config-subject', this.subjects)
        if (response.success === false) {
          throw new Error(response.error?.message || '保存失败')
        }
        this.originalSubjects = JSON.parse(JSON.stringify(this.subjects))
        this.showMessage('配置已保存', 'success')
      } catch (error) {
        console.error('Failed to save config:', error)
        this.showMessage(`保存失败: ${error.message}，请稍后重试`, 'error')
      }
      this.loading = false
    },

    showMessage(text, color = 'success') {
      this.snackbarText = text
      this.snackbarColor = color
      this.showSnackbar = true
    },

    addSubject() {
      const name = (this.newSubjectName || '').trim()
      if (!name) return

      this.subjects.push({
        name,
        order: this.subjects.length,
        multiHomework: false,
        extraSubjects: [],
      })

      this.newSubjectName = ''
    },

    updateSubject(subject) {
      const index = this.subjects.findIndex((s) => s.order === subject.order)
      if (index > -1) {
        this.subjects[index] = { ...subject }
      }
    },

    // 附加科目名去空白、挡重；空名和重复名直接忽略，不给提示吵人
    addExtraSubject(subject) {
      const name = (this.newExtraSubject || '').trim()
      if (!name || subject.extraSubjects.includes(name)) {
        this.newExtraSubject = ''
        return
      }
      subject.extraSubjects.push(name)
      this.newExtraSubject = ''
    },

    removeExtraSubject(subject, name) {
      const index = subject.extraSubjects.indexOf(name)
      if (index > -1) subject.extraSubjects.splice(index, 1)
    },

    deleteSubject(subject) {
      const index = this.subjects.findIndex((s) => s.order === subject.order)
      if (index > -1) {
        this.subjects.splice(index, 1)
        // 更新剩余科目的顺序
        this.subjects.forEach((s, i) => {
          s.order = i
        })
      }
      if (this.expandedOrder === subject.order) this.expandedOrder = null
    },

    moveSubject(index, direction) {
      const newIndex = index + direction
      if (newIndex >= 0 && newIndex < this.subjects.length) {
        // 顺序跟着挪，展开项要跟着换到新位置，否则会展开到别的科目上
        if (this.expandedOrder === index) this.expandedOrder = newIndex
        else if (this.expandedOrder === newIndex) this.expandedOrder = index
        // 交换位置
        const temp = this.subjects[index]
        this.subjects[index] = this.subjects[newIndex]
        this.subjects[newIndex] = temp
        // 更新顺序
        this.subjects.forEach((subject, i) => {
          subject.order = i
        })
      }
    },

    resetToDefault() {
      this.subjects = cloneDefaultSubjects()
      this.expandedOrder = null
      this.showMessage('已重置为默认科目列表', 'info')
    },
  },
}
</script>

<style scoped>
.v-list-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.v-list-item:last-child {
  border-bottom: none;
}

/* 附加属性展开区：占满内容列，缩进一点以区别于科目名那一行 */
.subject-extras {
  width: 100%;
  padding: 4px 0 12px 8px;
}
</style>
