import Sidebar from '@/components/Sidebar'

export const metadata = { title: 'Privacy Policy — Movora' }

export default function PrivacyPage() {
  return (
    <>
      <Sidebar />
      <div className="min-h-screen lg:pl-24 pb-24 lg:pb-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-10">Last updated: May 2026</p>

          <div className="space-y-8 text-muted-foreground leading-relaxed">

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
              <p>
                Movora does not require account registration. We store the following data locally
                in your browser only (localStorage), never on our servers:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>Watchlist items you save</li>
                <li>Continue watching progress</li>
              </ul>
              <p className="mt-3">
                We do not collect, store, or share any personally identifiable information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Third-Party Embeds</h2>
              <p>
                When you play content, an embedded player from a third-party provider loads in
                your browser. That provider may collect data according to their own privacy policy.
                We have no control over third-party data collection.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Cookies</h2>
              <p>
                Movora does not use tracking cookies. Third-party embed providers may set their
                own cookies when you interact with their player.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Analytics</h2>
              <p>
                We may collect anonymous, aggregated usage statistics (page views, error rates)
                through our hosting provider (Vercel). No personally identifiable data is included.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Data Retention</h2>
              <p>
                Since we do not collect personal data on our servers, there is nothing to delete.
                You can clear your watchlist and watch history at any time by clearing your
                browser's localStorage for this site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Children's Privacy</h2>
              <p>
                Movora is not directed at children under 13. We do not knowingly collect data
                from children.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Contact</h2>
              <p>
                Privacy concerns:{' '}
                <a href="mailto:privacy@movora.app" className="text-primary hover:underline">privacy@movora.app</a>
              </p>
            </section>

          </div>
        </div>
      </div>
    </>
  )
}
