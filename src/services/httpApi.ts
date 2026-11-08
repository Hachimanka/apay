import { useAuth } from '@/store/auth'
import type { ApayApi, Session } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  listEmployeeRecords: (employeeId) => request(`/apay/employees/${employeeId}/records`),
  saveEmployeeRecord: ({ id, employeeId, kind, data }) =>
    id
      ? request(`/apay/employees/${employeeId}/records/${id}`, { method: 'PUT', body: json({ data }) })
      : request(`/apay/employees/${employeeId}/records`, { method: 'POST', body: json({ kind, data }) }),
  deleteEmployeeRecord: (employeeId, id) => request(`/apay/employees/${employeeId}/records/${id}`, { method: 'DELETE' }),

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
  decideRequests: (ids, status) => request('/apay/requests/decisions', { method: 'POST', body: json({ ids, status }) }),
  fileRequest: (input) => request('/apay/requests', { method: 'POST', body: json(input) }),

  listLoans: (employeeId) => request(`/apay/loans${employeeId ? `?employeeId=${employeeId}` : ''}`),

  listPayEntries: (periodId) => request(`/apay/periods/${periodId}/entries`),
  addPayEntry: (periodId, input) => request(`/apay/periods/${periodId}/entries`, { method: 'POST', body: json(input) }),
  deletePayEntry: (periodId, entryId) => request(`/apay/periods/${periodId}/entries/${entryId}`, { method: 'DELETE' }),
  convertVacationLeave: (periodId, maxDays) => request(`/apay/periods/${periodId}/entries/convert-vl`, { method: 'POST', body: json({ maxDays }) }),
  thirteenthMonth: (year) => request(`/apay/thirteenth-month?year=${year}`),

  listFinalPays: () => request('/apay/final-pays'),

  listReports: () => request('/apay/reports'),

  listVessels: () => request('/apay/vessels'),
  saveVessel: ({ id, ...input }) =>
    id ? request(`/apay/vessels/${id}`, { method: 'PUT', body: json(input) }) : request('/apay/vessels', { method: 'POST', body: json(input) }),
  listCrew: (f = {}) => {
    const q = new URLSearchParams()
    if (f.employeeId) q.set('employeeId', f.employeeId)
    if (f.aboard) q.set('aboard', 'true')
    return request(`/apay/crew?${q}`)
  },
  saveCrewStint: ({ id, ...input }) =>
    id ? request(`/apay/crew/${id}`, { method: 'PUT', body: json(input) }) : request('/apay/crew', { method: 'POST', body: json(input) }),
  deleteCrewStint: (id) => request(`/apay/crew/${id}`, { method: 'DELETE' }),
  disembark: (id, input) => request(`/apay/crew/${id}/disembark`, { method: 'POST', body: json(input) }),
  listCadets: () => request('/apay/cadets'),
  saveCadet: ({ id, ...input }) =>
    id ? request(`/apay/cadets/${id}`, { method: 'PUT', body: json(input) }) : request('/apay/cadets', { method: 'POST', body: json(input) }),
  moveCadet: (id, stage, note) => request(`/apay/cadets/${id}/stage`, { method: 'POST', body: json({ stage, note }) }),
  listLicenses: (days = 90) => request(`/apay/licenses?days=${days}`),
  runReport: (key, params) => request(`/apay/reports/${key}?${new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][])}`),
  getFinalPay: (employeeId) => request(`/apay/employees/${employeeId}/final-pay`),
  computeFinalPay: (employeeId, separationDate, separationReason) =>
    request(`/apay/employees/${employeeId}/final-pay`, { method: 'POST', body: json({ separationDate, separationReason }) }),
  saveFinalPay: (employeeId, input) => request(`/apay/employees/${employeeId}/final-pay`, { method: 'PUT', body: json(input) }),
  setFinalPayStatus: (employeeId, status) => request(`/apay/employees/${employeeId}/final-pay/status`, { method: 'POST', body: json({ status }) }),
  deleteFinalPay: (employeeId) => request(`/apay/employees/${employeeId}/final-pay`, { method: 'DELETE' }),

  getPayslipEmails: (periodId) => request(`/apay/periods/${periodId}/payslip-emails`),
  sendPayslipEmails: (periodId, employeeIds) => request(`/apay/periods/${periodId}/payslip-emails`, { method: 'POST', body: json({ employeeIds }) }),

  listAnnouncements: () => request('/apay/announcements'),
  saveAnnouncement: (input) =>
    input.id
      ? request(`/apay/announcements/${input.id}`, { method: 'PUT', body: json(input) })
      : request('/apay/announcements', { method: 'POST', body: json(input) }),

  listHolidays: () => request('/apay/holidays'),
  saveHoliday: (input, originalDate) =>
    originalDate
      ? request(`/apay/holidays/${originalDate}`, { method: 'PUT', body: json(input) })
      : request('/apay/holidays', { method: 'POST', body: json(input) }),
  deleteHoliday: (date) => request(`/apay/holidays/${date}`, { method: 'DELETE' }),
  loadOfficialHolidays: () => request('/apay/holidays/load-official', { method: 'POST' }),

  listShifts: () => request('/apay/shifts'),
  saveShift: ({ id, ...input }) =>
    id ? request(`/apay/shifts/${id}`, { method: 'PUT', body: json(input) }) : request('/apay/shifts', { method: 'POST', body: json(input) }),
  deleteShift: (id) => request(`/apay/shifts/${id}`, { method: 'DELETE' }),

  getSettings: () => request('/apay/settings'),
  saveSettings: (input) => request('/apay/settings', { method: 'PUT', body: json(input) }),

  listAudit: () => request('/apay/audit'),
}
