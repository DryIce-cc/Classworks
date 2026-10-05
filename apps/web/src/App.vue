<template>
  <v-app>
    <router-view v-slot="{ Component, route }">
      <transition mode="out-in" name="md3">
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>
    <global-message />
  </v-app>
</template>

<script setup>
// 深色主题只在 plugins/vuetify.js 里定（defaultTheme: 'dark'），这里不再重复强制
</script>
<style>
@import '@/styles/index.scss';
@import '@/styles/transitions.scss';
@import '@/styles/global.scss';

.md3-enter-active,
.md3-leave-active {
  transition:
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.md3-enter-from {
  opacity: 0;
  transform: translateX(0.5vw);
}

.md3-leave-to {
  opacity: 0;
  transform: translateX(-0.5vw);
}
</style>
