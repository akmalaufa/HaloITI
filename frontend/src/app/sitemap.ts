import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://haloiti.akmalaufa.my.id',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    // Kalau lu punya halaman lain kayak about atau admin, bisa ditambahin di sini
    // {
    //   url: 'https://haloiti.akmalaufa.my.id/admin',
    //   lastModified: new Date(),
    //   changeFrequency: 'yearly',
    //   priority: 0.5,
    // },
  ]
}
