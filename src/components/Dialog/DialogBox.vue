<!--
  DialogBox
  - `@confirm`的处理函数会被`await`，返回值决定去留：`false`或抛错保持打开，其余关闭。
    异步操作要把Promise返回出来，否则对话框不会等它
  - 为此`onConfirm`必须是prop，改成emit就拿不到返回值
  - 用`v-if`卸载时等`closed`而不是`close`，否则退场动画会被切断
  - `title`插槽渲染在`<h2>`里，只放行内内容
-->
<script setup lang="ts">
import Button from '~/components/Button.vue'

import type { DialogClosedBy } from './BaseDialog.vue'
import BaseDialog from './BaseDialog.vue'

const props = defineProps<{
  title?: string
  desc?: string
  /** CSS长度，须带单位 */
  width?: string
  /** CSS长度，须带单位 */
  bodyHeight?: string
  closedby?: DialogClosedBy
  onConfirm?: () => unknown
}>()

const emit = defineEmits<{
  cancel: [event: Event]
  close: []
  closed: []
}>()

const open = defineModel<boolean>('open', { default: false })

const baseRef = useTemplateRef<InstanceType<typeof BaseDialog>>('base')
const formRef = useTemplateRef<HTMLFormElement>('form')
const confirmRef = useTemplateRef<InstanceType<typeof Button>>('confirm')
const busy = ref(false)
const titleId = useId()
const descId = useId()

async function handleSubmit() {
  const base = baseRef.value
  if (!base || busy.value)
    return
  if (!props.onConfirm) {
    base.close('confirm')
    return
  }

  // 必须在置`busy`之前：表单`inert`后焦点会掉到body，先交给dialog接住
  base.dialog?.focus()
  busy.value = true
  let result: unknown
  try {
    result = await props.onConfirm()
  }
  catch (error) {
    result = false
    reportError(error)
  }
  finally {
    busy.value = false
  }

  if (result === false) {
    // 等表单脱离`inert`，否则聚焦不上
    await nextTick()
    confirmRef.value?.$el.focus()
    return
  }
  base.close('confirm')
}

/** 只处理焦点在dialog本身时的Enter（比如点过卡片的留白处），这时没有隐式提交；控件上的Enter留给控件自己 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.target !== event.currentTarget || event.isComposing)
    return
  event.preventDefault()
  formRef.value?.requestSubmit()
}
</script>

<template>
  <BaseDialog
    ref="base"
    v-model:open="open"
    class="b-dialog-box"
    :closedby="busy ? 'none' : closedby"
    :aria-labelledby="titleId"
    :aria-describedby="desc || $slots.desc ? descId : undefined"
    :aria-busy="busy || undefined"
    :style="{ '--b-dialog-box-width': width, '--b-dialog-box-body-height': bodyHeight }"
    @cancel="emit('cancel', $event)"
    @close="emit('close')"
    @closed="emit('closed')"
    @keydown="handleKeydown"
  >
    <template #default="{ requestClose }">
      <form
        ref="form"
        class="b-dialog-box__form"
        method="dialog"
        :inert="busy"
        @submit.prevent="handleSubmit"
      >
        <div class="b-dialog-box__head">
          <div class="b-dialog-box__heading">
            <h2 :id="titleId" class="b-dialog-box__title">
              <slot name="title">
                {{ title }}
              </slot>
            </h2>
            <p v-if="desc || $slots.desc" :id="descId" class="b-dialog-box__desc">
              <slot name="desc">
                {{ desc }}
              </slot>
            </p>
          </div>
          <button
            type="button"
            class="b-dialog-box__close"
            :aria-label="$t('common.operation.close')"
            @click="requestClose()"
          >
            <div i-ic-baseline-clear />
          </button>
        </div>

        <div class="b-dialog-box__body">
          <slot />
        </div>

        <div v-if="onConfirm || $slots.footer" class="b-dialog-box__foot">
          <slot name="footer">
            <Button type="tertiary" @click="requestClose()">
              {{ $t('common.operation.cancel') }}
            </Button>
            <!-- 必须是表单里唯一的提交按钮，Enter的隐式提交认的是第一个；×和取消若不是`type=button`就会抢走它 -->
            <Button ref="confirm" type="primary" native-type="submit" value="confirm" autofocus>
              {{ $t('common.operation.confirm') }}
            </Button>
          </slot>
        </div>
      </form>

      <Transition name="fade">
        <div v-if="busy" class="b-dialog-box__busy" aria-hidden="true">
          <div i-svg-spinners-ring-resize />
        </div>
      </Transition>
    </template>
  </BaseDialog>
</template>

<style scoped>
.b-dialog-box {
  --uno: "rounded-$bew-radius border-1 border-$bew-border-color bg-$bew-elevated antialiased";
  border-style: solid;
  inline-size: var(--b-dialog-box-width, 400px);
  /* dialog自己不能滚，否则`inset: 0`的忙碌遮罩盖不全；滚动交给正文 */
  overflow: hidden;
  backdrop-filter: var(--bew-filter-glass-2);
  box-shadow: var(--bew-shadow-4), var(--bew-shadow-edge-glow-2);
}

/* `display`只能在`[open]`下改：关闭态要留给UA的`display: none`，退场过渡也靠它 */
.b-dialog-box[open] {
  display: flex;
  flex-direction: column;
}

.b-dialog-box__form {
  display: flex;
  flex-direction: column;
  min-block-size: 0;
}

.b-dialog-box__head {
  --uno: "flex items-center gap-8 px-12 py-4 min-h-70px box-border";
}

.b-dialog-box__heading {
  --uno: "flex-1 min-w-0";
}

.b-dialog-box__title {
  --uno: "m-0 text-xl fw-bold";
}

.b-dialog-box__desc {
  --uno: "m-0 text-sm text-$bew-text-2";
}

.b-dialog-box__close {
  --uno: "w-32px h-32px p-0 shrink-0 box-border flex items-center justify-center cursor-pointer duration-300";
  --uno: "rounded-8 border-1 border-$bew-border-color bg-$bew-fill-1 hover:bg-$bew-theme-color-30";
  --uno: "text-16px text-inherit hover:text-$bew-theme-color";
  backdrop-filter: var(--bew-filter-glass-1);
  box-shadow: var(--bew-shadow-edge-glow-1), var(--bew-shadow-1);
}

.b-dialog-box__body {
  --uno: "px-12 py-2";
  /* 给插槽内容当定位参照：里面绝对定位的元素才会随正文滚动、被正文裁剪 */
  position: relative;
  flex: 0 1 auto;
  min-block-size: 0;
  block-size: var(--b-dialog-box-body-height, auto);
  overflow: hidden auto;
  overscroll-behavior: contain;

  &:last-child {
    --uno: "pb-8";
  }
}

.b-dialog-box__foot {
  --uno: "flex gap-2 justify-end px-12 pt-2 pb-6";
}

.b-dialog-box__busy {
  --uno: "absolute inset-0 grid place-items-center text-4xl";
  --uno: "bg-white/60 dark:bg-black/60";
}
</style>
