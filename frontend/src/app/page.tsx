import { Features } from '@/components/features'
import { Hero } from '@/components/hero'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'

export default function Page() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      {/* subtle grid backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/3%)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/3%)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />
      <div className="relative">
        <Navbar />
        <Hero />
        <Features />
        <Footer />
      </div>
    </main>
  )
}
