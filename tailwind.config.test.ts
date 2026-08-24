import { describe, it, expect } from 'vitest'
import tailwindConfig from './tailwind.config'

describe('design tokens', () => {
  it('defines the expected color roles', () => {
    const colors = (tailwindConfig.theme?.extend as { colors: Record<string, unknown> }).colors
    expect(Object.keys(colors)).toEqual(
      expect.arrayContaining([
        'background',
        'foreground',
        'primary',
        'secondary',
        'card',
        'muted',
        'border',
        'destructive',
      ]),
    )
  })

  it('defines heading and body font families', () => {
    const fontFamily = (tailwindConfig.theme?.extend as { fontFamily: Record<string, unknown> })
      .fontFamily
    expect(fontFamily.heading).toBeDefined()
    expect(fontFamily.body).toBeDefined()
  })
})
