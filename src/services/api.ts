import { httpApi } from './httpApi'
import { mockApi } from './mock/mockApi'

/** Switch with VITE_API_MODE=http once aznar-api is deployed. */
export const api = import.meta.env.VITE_API_MODE === 'http' ? httpApi : mockApi

export const isMockApi = api === mockApi
