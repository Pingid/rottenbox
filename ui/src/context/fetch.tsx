import { createContext, useContext } from 'solid-js'
import { Req } from '../lib'

export * from '../lib/util/req'

const Context = createContext<Req.Requester>(Req.fromFetch())
export const Provider = Context.Provider
export const use = () => Req.Client.from(useContext(Context))
