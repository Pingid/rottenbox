import { createContext, useContext } from 'solid-js'
import { Req } from '../lib'

export * from '../lib/util/req'

/**
 * Ask for access to an origin the fetcher can't reach yet (extension host
 * permissions); resolves to whether it was granted. Absent where every
 * origin is reachable already (dev server, userscript).
 */
export type Grant = (origin: string) => Promise<boolean>

type Ctx = { requester: Req.Requester; grant?: Grant }

const Context = createContext<Ctx>({ requester: Req.fromFetch() })
export const Provider = Context.Provider
export const use = () => Req.Client.from(useContext(Context).requester)
export const useGrant = () => useContext(Context).grant
