<script setup lang="ts">
defineProps<{
  modelValue: string | number
}>()

const model = defineModel<string | number>()
</script>

<template>
  <textarea
    v-model="model"
    w-full h-500px border="1 solid $bew-border-color" rounded="4px" p-2
    outline-none bg="$bew-fill-1"
  />
</template>

<style lang="scss" scoped>
textarea {
  font-family: Consolas, monospace, sans-serif; /* 1 */
}
</style>
