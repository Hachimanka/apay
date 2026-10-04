import { useAuth } from '@/store/auth'
import type { ApayApi, Session } from './types'

const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuth.getState().session?.token
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (res.status === 401) useAuth.getState().logout()
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.message ?? res.statusText, res.status)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const json = (body: unknown) => JSON.stringify(body)

/** Real aznar-api adapter — APAY routes live under /apay, auth under /auth. */
export const httpApi: ApayApi = {
  login: (email, password) => request<Session>('/auth/login', { method: 'POST', body: json({ email, password, app: 'apay' }) }),
  requestPasswordReset: (email) => request('/auth/apay/forgot-password', { method: 'POST', body: json({ email }) }),
  resetPassword: (token, password) => request('/auth/apay/reset-password', { method: 'POST', body: json({ token, password }) }),

  listEmployees: () => request('/apay/employees'),
  getEmployee: (id) => request(`/apay/employees/${id}`),
  getEmployeeAvatar: (id) => request(`/apay/employees/${id}/avatar`),
  createEmployee: (input) => request('/apay/employees', { method: 'POST', body: json(input) }),
  saveEmployee: (input) => request(`/apay/employees/${input.id}`, { method: 'PUT', body: json(input) }),

  listPeriods: () => request('/apay/periods'),
  getPeriod: (id) => request(`/apay/periods/${id}`),
  getAttendance: (id) => request(`/apay/periods/${id}/attendance`),
  saveAttendance: (id, source, rows) => request(`/apay/periods/${id}/attendance`, { method: 'PUT', body: json({ source, rows }) }),
  resetAttendance: (id, employeeId) => request(`/apay/periods/${id}/attendance/${employeeId}`, { method: 'DELETE' }),
  getDailyAttendance: (date) => request(`/apay/attendance/daily?date=${date}`),
  saveTimeRecords: (source, rows) => request('/apay/attendance/daily', { method: 'PUT', body: json({ source, rows }) }),
  getPayrollLines: (id) => request(`/apay/periods/${id}/lines`),
  computePayroll: (id) => request(`/apay/periods/${id}/compute`, { method: 'POST' }),
  setPeriodStatus: (id, status) => request(`/apay/periods/${id}/status`, { method: 'POST', body: json({ status }) }),

  listAdjustments: () => request('/apay/adjustments'),
  saveAdjustment: (input) =>
    input.id
      ? request(`/apay/adjustments/${input.id}`, { method: 'PUT', body: json(input) })
      : request('/apay/adjustments', { method: 'POST', body: json(input) }),

  listOvertime: () => request('/apay/overtime'),
  decideOvertime: (id, status) => request(`/apay/overtime/${id}/decision`, { method: 'POST', body: json({ status }) }),

  listLeaves: () => request('/apay/leaves'),
  decideLeave: (id, status) => request(`/apay/leaves/${id}/decision`, { method: 'POST', body: json({ status }) }),

  listRequests: () => request('/apay/requests'),
  decideRequest: (id, status, overtime) => request(`/apay/requests/${id}/decision`, { method: 'POST', body: json({ status, overtime }) }),

  listAnnouncements: () => request('/apay/announcements'),
  saveAnnouncement: (input) =>
    input.id
      ? request(`/apay/announcements/${input.id}`, { method: 'PUT', body: json(input) })
      : request('/apay/announcements', { method: 'POST', body: json(input) }),

  getSettings: () => request('/apay/settings'),
  saveSettings: (input) => request('/apay/settings', { method: 'PUT', body: json(input) }),

  listAudit: () => request('/apay/audit'),
}
