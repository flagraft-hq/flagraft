import axios from 'axios'
import { http, flagsApi, overridesApi, contextFieldsApi, projectsApi } from '../api'

describe('http instance', () => {
  it('is an axios instance', () => {
    expect(axios.isAxiosError).toBeDefined()
    expect(http.defaults.timeout).toBe(10_000)
  })
  it('has request interceptors registered', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    expect((http.interceptors.request as any).handlers.length).toBeGreaterThan(0)
  })
  it('has response interceptors registered', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    expect((http.interceptors.response as any).handlers.length).toBeGreaterThan(0)
  })
})

describe('flagsApi', () => {
  it('exports list, get, toggle, create, update, delete', () => {
    expect(typeof flagsApi.list).toBe('function')
    expect(typeof flagsApi.get).toBe('function')
    expect(typeof flagsApi.toggle).toBe('function')
    expect(typeof flagsApi.create).toBe('function')
    expect(typeof flagsApi.update).toBe('function')
    expect(typeof flagsApi.delete).toBe('function')
  })
})

describe('overridesApi', () => {
  it('exports list, create, update, delete, reorder', () => {
    expect(typeof overridesApi.list).toBe('function')
    expect(typeof overridesApi.create).toBe('function')
    expect(typeof overridesApi.update).toBe('function')
    expect(typeof overridesApi.delete).toBe('function')
    expect(typeof overridesApi.reorder).toBe('function')
  })
})

describe('contextFieldsApi', () => {
  it('exports list', () => {
    expect(typeof contextFieldsApi.list).toBe('function')
  })
})

describe('projectsApi', () => {
  it('exports list and get', () => {
    expect(typeof projectsApi.list).toBe('function')
    expect(typeof projectsApi.get).toBe('function')
  })
})
