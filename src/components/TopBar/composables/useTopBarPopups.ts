import { onClickOutside } from '@vueuse/core'
import type { InjectionKey, Ref } from 'vue'

import { useDelayedHover } from '~/composables/useDelayedHover'
import { settings } from '~/logic'

interface TopBarPopups {
  activePopup: Ref<string | null>
  clickedPopup: Ref<string | null>
}

const TOP_BAR_POPUPS_KEY: InjectionKey<TopBarPopups> = Symbol('TopBarPopups')

export function provideTopBarPopups(): TopBarPopups {
  const popups: TopBarPopups = {
    activePopup: ref(null),
    clickedPopup: ref(null),
  }
  provide(TOP_BAR_POPUPS_KEY, popups)
  return popups
}

export function useTopBarPopup(
  key: string,
  el: Ref<HTMLElement | null | undefined>,
  { activePopup, clickedPopup }: TopBarPopups = inject(TOP_BAR_POPUPS_KEY)!,
) {
  const isOpen = computed(() => activePopup.value === key)

  function close() {
    if (isOpen.value)
      activePopup.value = null
  }

  useDelayedHover({
    el,
    enterDelay: 320,
    leaveDelay: 320,
    beforeEnter: () => {
      if (!isOpen.value)
        activePopup.value = null
    },
    enter: () => {
      activePopup.value = key
    },
    leave: close,
  })

  function handleClick(event: MouseEvent) {
    if (!settings.value.touchScreenOptimization)
      return

    event.preventDefault()
    activePopup.value = isOpen.value ? null : key
    clickedPopup.value = key
  }

  onClickOutside(el, () => {
    if (clickedPopup.value === key)
      close()
  })

  return { isOpen, handleClick }
}
