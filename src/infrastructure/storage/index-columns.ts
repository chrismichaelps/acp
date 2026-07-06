/** @Acp.Infra.Storage.IndexColumns — promoted scoping columns shared by adapters */
export const INDEXED_FIELDS = [
  'workspace_id',
  'work_id',
  'state',
  'assigned_to',
  'priority',
  'holder',
  'kind',
] as const

export type IndexedField = (typeof INDEXED_FIELDS)[number]

export const extractIndexColumns = (
  value: unknown,
): Record<IndexedField, string | null> => {
  const obj =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}
  const out = {} as Record<IndexedField, string | null>
  for (const field of INDEXED_FIELDS) {
    const v = obj[field]
    out[field] = typeof v === 'string' ? v : null
  }
  return out
}
