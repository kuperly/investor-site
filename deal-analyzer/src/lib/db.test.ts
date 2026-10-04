import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { splitSql } from './db'

describe('db/schema.sql', () => {
  const schema = readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8')
  it('has no ";" inside an inline -- comment (the splitter cuts on ";")', () => {
    const bad = schema.split('\n').filter((l) => l.includes('--') && l.slice(l.indexOf('--')).includes(';') && !l.trim().startsWith('--'))
    expect(bad).toEqual([])
  })
  it('splits into statements with no comment fragments', () => {
    for (const stmt of splitSql(schema)) expect(stmt).toMatch(/^(create|alter)\s/i)
  })
})
