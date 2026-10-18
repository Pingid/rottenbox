import { renderInline } from '@rottenbox/ui/app'
import * as Enabled from '@/lib/enabled'

import { storage } from '@/lib/storage'
import { content, grant } from '@/lib/fetch'

import styles from '../index.css?inline'

let unmount: (() => void) | undefined

// mount / unmount live as the toolbar icon toggles it, no reload needed
Enabled.watch((enabled) => {
  if (enabled && !unmount) unmount = renderInline({ styles, storage: storage(), fetcher: content(), grant })
  else if (!enabled && unmount) (unmount(), (unmount = undefined))
})
