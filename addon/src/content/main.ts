import { renderInline } from '@rottenbox/ui/app'
import styles from '../index.css?inline'
import * as Enabled from '@/lib/enabled'

import { storage } from '@/lib/storage'

let unmount: (() => void) | undefined

// mount / unmount live as the toolbar icon toggles it, no reload needed
Enabled.watch((enabled) => {
  if (enabled && !unmount) unmount = renderInline({ styles, storage: storage() })
  else if (!enabled && unmount) (unmount(), (unmount = undefined))
})
