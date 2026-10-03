<template>
  <div class="settings-page">
    <v-toolbar color="surface" elevation="1">
      <template #prepend>
        <v-btn icon="mdi-arrow-left" variant="text" @click="$router.push('/')" />
      </template>
      <v-toolbar-title class="text-h6"> 设置 </v-toolbar-title>
    </v-toolbar>

    <v-container fluid>
      <v-navigation-drawer permanent>
        <v-list>
          <v-list-item
            v-for="tab in settingsTabs"
            :key="tab.value"
            :active="settingsTab === tab.value"
            :color="settingsTab === tab.value ? 'primary' : 'default'"
            :prepend-icon="tab.icon"
            class="rounded-e-xl"
            @click="settingsTab = tab.value"
          >
            <v-list-item-title>{{ tab.title }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-navigation-drawer>

      <v-tabs-window v-model="settingsTab" direction="vertical" style="width: 100%">
        <v-tabs-window-item value="subject">
          <subject-management-card border />
          <br />
          <homework-template-card border />
        </v-tabs-window-item>

        <v-tabs-window-item value="developer">
          <v-card border class="rounded-lg">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" icon="mdi-cog-outline" />
              所有设置
            </v-card-title>
            <v-card-subtitle>浏览和修改所有可用设置</v-card-subtitle>
            <v-card-text>
              <settings-explorer />
            </v-card-text>
          </v-card>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-container>
  </div>
</template>

<script>
import HomeworkTemplateCard from '@/components/settings/cards/HomeworkTemplateCard.vue'
import SubjectManagementCard from '@/components/settings/cards/SubjectManagementCard.vue'
import SettingsExplorer from '@/components/settings/SettingsExplorer.vue'

export default {
  name: 'Settings',
  components: {
    HomeworkTemplateCard,
    SubjectManagementCard,
    SettingsExplorer,
  },
  data() {
    return {
      settingsTab: 'subject',
      settingsTabs: [
        { title: '科目', icon: 'mdi-book-edit', value: 'subject' },
        { title: '开发者', icon: 'mdi-developer-board', value: 'developer' },
      ],
    }
  },
}
</script>

<style lang="scss">
.settings-page {
  .v-card {
    transition:
      transform 0.2s,
      box-shadow 0.2s;

    &:hover {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1) !important;
    }
  }
}
</style>
