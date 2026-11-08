/**
 * Phase 6 platform features: access rights, data privacy, biometric devices, punch location rules, backup and
 * applicant tracking. Kept apart from the core ApayApi; in demo (mock) mode they show sample data and saving is disabled.
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockApi } from './api'
import { request } from './httpApi'
import type { Permission } from '@/lib/permissions'
import type { Role } from './types'
import { useAuth } from '@/store/auth'

/* ----------------------------------- Types ----------------------------------- */

export type OtherRole = Exclude<Role, 'hr'>
export type RoleMatrix = Record<OtherRole, Permission[]>
export type StaffAccount = { id: string; name: string; email: string; title: string; role: Role; active: boolean; employeeId: string | null; lastLoginAt: string | null }
export type AccessInfo = { permissions: Permission[]; matrix: RoleMatrix; accounts: StaffAccount[] }

export type PrivacySettings = { noticeVersion: string; notice: string; retentionYears: number }
export type PrivacyOverview = {
  settings: PrivacySettings
  consent: { total: number; consented: number; older: number }
  dueForErasure: { employeeId: string; employeeNo: string; name: string; separationDate: string; erasableFrom: string }[]
}
export type EmployeePrivacy = {
  consentAt: string | null
  consentVersion: string | null
  currentVersion: string
  anonymizedAt: string | null
  retentionYears: number
  erasableFrom: string | null
}

export type Device = {
  id: string
  name: string
  location: string
  keyPrefix: string
  active: boolean
  lastSeenAt: string | null
  lastBatch: { received: number; saved: number; skipped: number; errors: string[] } | null
  createdAt: string
}

export type GeoSite = { name: string; lat: number; lng: number; radius: number }
export type Geofence = { mode: 'off' | 'record' | 'enforce'; sites: GeoSite[] }
export type GeoPoint = { lat: number; lng: number; accuracy: number; site?: string; distance?: number; outside?: boolean }

export const applicantStages = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'] as const
export type ApplicantStage = (typeof applicantStages)[number]
export const preEmploymentDocs = {
  resume: 'Résumé / bio-data',
  nbi: 'NBI clearance',
  medical: 'Pre-employment medical',
  birth_certificate: 'PSA birth certificate',
  diploma: 'Diploma',
  tor: 'Transcript of records',
  sss: 'SSS number',
  philhealth: 'PhilHealth number',
  pagibig: 'Pag-IBIG number',
  tin: 'TIN',
  id_photo: '2×2 ID photos',
  coe_previous: 'COE from previous employer',
  bir_2316_previous: 'BIR 2316 from previous employer',
} as const
export type PreEmploymentDoc = keyof typeof preEmploymentDocs
export type DocStatus = { received: boolean; date?: string; note?: string }

export type Applicant = {
  id: string
  firstName: string
  middleName: string
  lastName: string
  fullName: string
  email: string
  phone: string
  position: string
  department: string
  source: string
  expectedSalary: string
  appliedDate: string
  stage: ApplicantStage
  stageHistory: { stage: ApplicantStage; date: string; note: string; by: string }[]
  interviewAt: string | null
  rating: number | null
  documents: Partial<Record<PreEmploymentDoc, DocStatus>>
  notes: string
  employeeId: string | null
  documentsReceived: number
  documentsTotal: number
}
export type ApplicantInput = Omit<Applicant, 'id' | 'fullName' | 'stage' | 'stageHistory' | 'employeeId' | 'documentsReceived' | 'documentsTotal'> & { id?: string }

/* ------------------------------------ Demo ------------------------------------ */

const demoError = () => Promise.reject(new Error('Connect APAY to aznar-api to use this (demo mode)'))
const demo = {
  access: (): AccessInfo => ({ permissions: [], matrix: { payroll_admin: [], finance: [], management: [] }, accounts: [] }),
  privacy: (): PrivacyOverview => ({ settings: { noticeVersion: '2026-11', notice: 'Demo privacy notice.', retentionYears: 5 }, consent: { total: 0, consented: 0, older: 0 }, dueForErasure: [] }),
}

/* ------------------------------------ API ------------------------------------ */

const json = (b: unknown) => JSON.stringify(b)
const live = <T,>(fn: () => Promise<T>, fallback: () => T) => (isMockApi ? Promise.resolve(fallback()) : fn())
const write = <T,>(fn: () => Promise<T>) => (isMockApi ? (demoError() as Promise<T>) : fn())

export const platformApi = {
  me: () => request<{ role: Role; permissions: Permission[] }>('/apay/me'),
  access: () => live(() => request<AccessInfo>('/apay/access'), demo.access),
  saveRoles: (m: RoleMatrix) => write(() => request<{ matrix: RoleMatrix }>('/apay/access/roles', { method: 'PUT', body: json(m) })),
  addAccount: (input: { name: string; email: string; title: string; role: Role }) =>
    write(() => request<{ account: StaffAccount; temporaryPassword: string | null }>('/apay/access/accounts', { method: 'POST', body: json(input) })),
  updateAccount: (id: string, input: { role?: Role | 'employee'; active?: boolean; title?: string }) =>
    write(() => request<StaffAccount>(`/apay/access/accounts/${id}`, { method: 'PUT', body: json(input) })),

  privacy: () => live(() => request<PrivacyOverview>('/apay/privacy'), demo.privacy),
  savePrivacy: (s: PrivacySettings) => write(() => request<PrivacySettings>('/apay/privacy', { method: 'PUT', body: json(s) })),
  employeePrivacy: (id: string) =>
    live(
      () => request<EmployeePrivacy>(`/apay/employees/${id}/privacy`),
      (): EmployeePrivacy => ({ consentAt: null, consentVersion: null, currentVersion: '2026-11', anonymizedAt: null, retentionYears: 5, erasableFrom: null }),
    ),
  exportPersonalData: (id: string) => write(() => request<Record<string, unknown> & { subject: { name: string; employeeNo: string } }>(`/apay/employees/${id}/privacy-export`)),
  anonymize: (id: string, confirm: string) => write(() => request<{ ok: true; name: string }>(`/apay/employees/${id}/anonymize`, { method: 'POST', body: json({ confirm }) })),

  devices: () => live(() => request<Device[]>('/apay/devices'), () => [] as Device[]),
  addDevice: (input: { name: string; location: string }) => write(() => request<{ device: Device; key: string }>('/apay/devices', { method: 'POST', body: json(input) })),
  updateDevice: (id: string, input: { name: string; location: string; active: boolean }) =>
    write(() => request<Device>(`/apay/devices/${id}`, { method: 'PUT', body: json(input) })),
  rotateDevice: (id: string) => write(() => request<{ device: Device; key: string }>(`/apay/devices/${id}/rotate`, { method: 'POST' })),
  deleteDevice: (id: string) => write(() => request<void>(`/apay/devices/${id}`, { method: 'DELETE' })),

  geofence: () => live(() => request<Geofence>('/apay/geofence'), (): Geofence => ({ mode: 'record', sites: [] })),
  saveGeofence: (g: Geofence) => write(() => request<Geofence>('/apay/geofence', { method: 'PUT', body: json(g) })),

  backupStatus: () => live(() => request<{ lastExportAt: string | null; by: string | null }>('/apay/backup/status'), () => ({ lastExportAt: null, by: null })),
  backup: () => write(() => request<{ createdAt: string; counts: Record<string, number> }>('/apay/backup')),

  applicants: (employeeId?: string) => live(() => request<Applicant[]>(`/apay/applicants${employeeId ? `?employeeId=${employeeId}` : ''}`), () => [] as Applicant[]),
  saveApplicant: ({ id, ...input }: ApplicantInput) =>
    write(() =>
      id ? request<Applicant>(`/apay/applicants/${id}`, { method: 'PUT', body: json(input) }) : request<Applicant>('/apay/applicants', { method: 'POST', body: json(input) }),
    ),
  moveApplicant: (id: string, stage: ApplicantStage, note = '') => write(() => request<Applicant>(`/apay/applicants/${id}/stage`, { method: 'POST', body: json({ stage, note }) })),
  deleteApplicant: (id: string) => write(() => request<void>(`/apay/applicants/${id}`, { method: 'DELETE' })),
}

/* ----------------------------------- Hooks ----------------------------------- */

const k = {
  access: ['access'] as const,
  privacy: ['privacy'] as const,
  devices: ['devices'] as const,
  geofence: ['geofence'] as const,
  backup: ['backup-status'] as const,
  applicants: ['applicants'] as const,
}

function useDone(...keys: (readonly unknown[])[]) {
  const qc = useQueryClient()
  return () => Promise.all([...keys, ['audit']].map((queryKey) => qc.invalidateQueries({ queryKey })))
}

/** Pick up access-right changes made while signed in (on load and when the window regains focus). */
export function useRefreshPermissions() {
  const setPermissions = useAuth((s) => s.setPermissions)
  const signedIn = useAuth((s) => !!s.session)
  const { data } = useQuery({ queryKey: ['me'], queryFn: platformApi.me, enabled: signedIn && !isMockApi, staleTime: 30_000, refetchOnWindowFocus: true })
  useEffect(() => {
    if (data) setPermissions(data.permissions)
  }, [data, setPermissions])
}

export const useAccess = () => useQuery({ queryKey: k.access, queryFn: platformApi.access })
export function useAccessMutations() {
  const done = useDone(k.access)
  return {
    saveRoles: useMutation({ mutationFn: platformApi.saveRoles, onSuccess: done }),
    addAccount: useMutation({ mutationFn: platformApi.addAccount, onSuccess: done }),
    updateAccount: useMutation({ mutationFn: (v: { id: string } & Parameters<typeof platformApi.updateAccount>[1]) => platformApi.updateAccount(v.id, v), onSuccess: done }),
  }
}

export const usePrivacy = () => useQuery({ queryKey: k.privacy, queryFn: platformApi.privacy })
export const useEmployeePrivacy = (id: string) => useQuery({ queryKey: ['employees', id, 'privacy'], queryFn: () => platformApi.employeePrivacy(id) })
export function usePrivacyMutations() {
  const done = useDone(k.privacy, ['employees'])
  return {
    save: useMutation({ mutationFn: platformApi.savePrivacy, onSuccess: done }),
    anonymize: useMutation({ mutationFn: (v: { id: string; confirm: string }) => platformApi.anonymize(v.id, v.confirm), onSuccess: done }),
  }
}

export const useDevices = () => useQuery({ queryKey: k.devices, queryFn: platformApi.devices })
export function useDeviceMutations() {
  const done = useDone(k.devices)
  return {
    add: useMutation({ mutationFn: platformApi.addDevice, onSuccess: done }),
    update: useMutation({ mutationFn: (v: { id: string; name: string; location: string; active: boolean }) => platformApi.updateDevice(v.id, v), onSuccess: done }),
    rotate: useMutation({ mutationFn: platformApi.rotateDevice, onSuccess: done }),
    remove: useMutation({ mutationFn: platformApi.deleteDevice, onSuccess: done }),
  }
}

export const useGeofence = () => useQuery({ queryKey: k.geofence, queryFn: platformApi.geofence })
export function useSaveGeofence() {
  return useMutation({ mutationFn: platformApi.saveGeofence, onSuccess: useDone(k.geofence) })
}

export const useBackupStatus = () => useQuery({ queryKey: k.backup, queryFn: platformApi.backupStatus })

export const useApplicants = (employeeId?: string) => useQuery({ queryKey: [...k.applicants, employeeId ?? 'all'], queryFn: () => platformApi.applicants(employeeId) })
export function useApplicantMutations() {
  const done = useDone(k.applicants)
  return {
    save: useMutation({ mutationFn: platformApi.saveApplicant, onSuccess: done }),
    move: useMutation({ mutationFn: (v: { id: string; stage: ApplicantStage; note?: string }) => platformApi.moveApplicant(v.id, v.stage, v.note), onSuccess: done }),
    remove: useMutation({ mutationFn: platformApi.deleteApplicant, onSuccess: done }),
  }
}

/** Save a JSON object as a file download. */
export function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
