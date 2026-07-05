import { OPS_BY_TYPE } from '../types'

describe('OPS_BY_TYPE', () => {
  it('covers all field types', () => {
    const expectedTypes = ['string', 'enum', 'boolean', 'number', 'version', 'date']
    expectedTypes.forEach((t) => {
      expect(OPS_BY_TYPE).toHaveProperty(t)
      expect(Array.isArray(OPS_BY_TYPE[t as keyof typeof OPS_BY_TYPE])).toBe(true)
    })
  })

  it('each operator entry has value and label', () => {
    Object.values(OPS_BY_TYPE).forEach((ops) => {
      ops.forEach((op) => {
        expect(op).toHaveProperty('value')
        expect(op).toHaveProperty('label')
        expect(typeof op.value).toBe('string')
        expect(typeof op.label).toBe('string')
      })
    })
  })

  it('string type has 5 operators', () => {
    expect(OPS_BY_TYPE.string).toHaveLength(5)
  })

  it('boolean type has 1 operator (is)', () => {
    expect(OPS_BY_TYPE.boolean).toHaveLength(1)
    expect(OPS_BY_TYPE.boolean[0].value).toBe('is')
  })
})
