import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/site-config'

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Social share card: the mark, the name, and the positioning line on charcoal. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: '#121110',
          color: '#F2EEE6',
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <path d="M3 5h6.2L16 19.4V27z" fill="#C4A46A" />
            <path d="M29 5h-6.2L16 19.4V27z" fill="#C4A46A" opacity="0.62" />
            <path d="M16 7.6l2.6 2.6L16 12.8l-2.6-2.6z" fill="#F2EEE6" />
          </svg>
          <div style={{ display: 'flex', fontSize: 48, fontFamily: 'sans-serif', fontWeight: 600 }}>
            Vale<span style={{ color: '#C4A46A' }}>Forge</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 88, lineHeight: 1.05, letterSpacing: -2 }}>{siteConfig.tagline}</div>
          <div style={{ marginTop: 28, fontSize: 30, color: '#A9A296', fontFamily: 'sans-serif' }}>
            U.S. Real Estate Investment
          </div>
        </div>
      </div>
    ),
    size,
  )
}
