/**
 * The market ValeForge is currently focused on, and the photography that
 * goes with it. To switch markets (e.g. to Indianapolis), add an entry to
 * `markets` with its own copy and Unsplash photos under
 * public/images/markets/<key>/, then change `activeMarket`.
 *
 * Photos are from Unsplash under the free Unsplash License (commercial use
 * allowed, attribution not required; credits kept here for reference). They are illustrative
 * of the market only — never present them as ValeForge properties or deals.
 */

type Photo = {
  src: string
  alt: string
  credit: { name: string; url: string }
}

type Market = {
  name: string
  short: string
  state: string
  title: string
  body: string
  photos: { hero: Photo; market: Photo; residential: Photo }
}

const markets = {
  dfw: {
    name: 'Dallas–Fort Worth',
    short: 'DFW',
    state: 'Texas',
    title: 'Focused on Dallas–Fort Worth.',
    body: 'One of the largest, most active housing markets in the country — and a steady source of the misaligned assets we look for.',
    photos: {
      hero: {
        src: '/images/markets/dfw/dallas-skyline.jpg',
        alt: 'Downtown Dallas skyline at sunset, seen across the Trinity River',
        credit: { name: 'Daniel Halseth', url: 'https://unsplash.com/photos/HCOlaPWCU8U' },
      },
      market: {
        src: '/images/markets/dfw/fort-worth-skyline.jpg',
        alt: 'Fort Worth skyline at dusk above the Trinity River',
        credit: { name: 'Matthew Lancaster', url: 'https://unsplash.com/photos/vSc0f1OuIRw' },
      },
      residential: {
        src: '/images/markets/dfw/carrollton-home.jpg',
        alt: 'A brick single-family home in Carrollton, a Dallas suburb',
        credit: { name: 'Herve', url: 'https://unsplash.com/photos/jbG99SAmXjM' },
      },
    },
  },
} satisfies Record<string, Market>

export const activeMarket: Market = markets.dfw
