<template>
  <div class="settings-page">
    <v-toolbar color="surface" elevation="1">
      <template #prepend>
        <v-btn icon="mdi-arrow-left" variant="text" @click="$router.push('/')" />
      </template>
      <v-toolbar-title class="text-h6">设置</v-toolbar-title>
    </v-toolbar>

    <v-container class="settings-body" fluid>
      <subject-management-card />
    </v-container>
  </div>
</template>

<script>
import SubjectManagementCard from '@/components/settings/cards/SubjectManagementCard.vue'

export default {
  name: 'Settings',
  components: {
    SubjectManagementCard,
  },
}
</script>

<style scoped>
.settings-body {
  padding: 16px;
}
</style>
