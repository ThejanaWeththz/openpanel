import { Footer } from '@/components/footer';
import { Hero } from '@/components/hero';
import Navbar from '@/components/navbar';
import { Faq } from '@/components/sections/faq';
import { Features } from '@/components/sections/features';
import { Pricing } from '@/components/sections/pricing';
import { Sdks } from '@/components/sections/sdks';
import { Stats, StatsPure } from '@/components/sections/stats';
import { Testimonials } from '@/components/sections/testimonials';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'OpenPanel | An open-source alternative to Mixpanel',
};

// export const experimental_ppr = true;

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Testimonials />
        <Suspense
          fallback={
            <StatsPure projectCount={0} eventCount={0} last24hCount={0} />
          }
        >
          <Stats />
        </Suspense>
        <Faq />
        <Pricing />
        <Sdks />
      </main>
      <Footer />
    </>
  );
}
