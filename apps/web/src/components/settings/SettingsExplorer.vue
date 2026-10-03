<template>
  <div>
    <v-text-field
      v-model="search"
      class="mb-4"
      density="comfortable"
      hide-details
      label="搜索设置项"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
    />
    <v-list density="compact">
      <setting-item
        v-for="key in filteredKeys"
        :key="key"
        :setting-key="key"
      />
    </v-list>
    <v-btn class="mt-4" color="error" variant="tonal" @click="resetAll">
      重置全部设置
    </v-btn>
  </div>
</template>

<script>
import SettingItem from './SettingItem.vue'
import { settingsDefinitions, resetAllSettings } from '@/utils/settings'

export default {
  name: 'SettingsExplorer',
  components: { SettingItem },
  data() {
    return { search: '' }
  },
  computed: {
    filteredKeys() {
      const keys = Object.keys(settingsDefinitions)
      if (!this.search.trim()) return keys
      const q = this.search.trim().toLowerCase()
      return keys.filter(
        (k) =>
          k.toLowerCase().includes(q) ||
          (settingsDefinitions[k].description || '').toLowerCase().includes(q),
      )
    },
  },
  methods: {
    resetAll() {
      resetAllSettings()
    },
  },
}
</script>
