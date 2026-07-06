import { describe, expect, it } from 'vitest'
import { INDEXED_FIELDS, extractIndexColumns } from './index-columns.js'

describe('extractIndexColumns', () => {
  it('pulls indexed fields and nulls the rest', () => {
    const cols = extractIndexColumns({
      id: 'w1', workspace_id: 'ws1', state: 'open', priority: 'high',
    })
    expect(cols.workspace_id).toBe('ws1')
    expect(cols.state).toBe('open')
    expect(cols.work_id).toBeNull()
    expect(Object.keys(cols).sort()).toEqual([...INDEXED_FIELDS].sort())
  })
  it('nulls everything for non-objects', () => {
    expect(extractIndexColumns('nope').workspace_id).toBeNull()
  })
})
