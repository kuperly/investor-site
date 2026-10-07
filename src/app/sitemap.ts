import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/site-config'

export default function sitemap(): MetadataRoute.Sitemap {
  return siteConfig.nav.map((item) => ({
    url: `${siteConfig.url}${item.href === '/' ? '' : item.href}`,
    changeFrequency: 'monthly',
    priority: item.href === '/' ? 1 : 0.7,
  }))
}
