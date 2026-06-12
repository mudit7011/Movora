import Sidebar from '@/components/Sidebar'

export const metadata = { title: 'Terms of Service — Movora' }

export default function TermsPage() {
  return (
    <>
      <Sidebar />
      <div className="min-h-screen lg:pl-24 pb-24 lg:pb-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-10">Last updated: May 2026</p>

          <div className="space-y-8 text-muted-foreground leading-relaxed">

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Nature of Service</h2>
              <p>
                Movora is an automated search engine and link aggregator. We do not host, store,
                upload, or transmit any video, audio, or media files. All content is hosted on
                third-party platforms. Movora merely indexes publicly accessible URLs, similar to
                how a general-purpose search engine indexes web pages.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. User Responsibilities</h2>
              <p>
                By using Movora, you agree that you are solely responsible for ensuring that your
                use of linked content complies with the laws of your jurisdiction. You agree not to
                use Movora for any unlawful purpose.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Third-Party Content</h2>
              <p>
                Movora has no control over, and assumes no responsibility for, the content, privacy
                policies, or practices of any third-party websites linked through our service.
                We do not warrant the accuracy, completeness, or legality of any third-party content.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Disclaimer of Warranties</h2>
              <p>
                Movora is provided "as is" without any warranties of any kind. We do not guarantee
                that links will be functional, that content will be available, or that the service
                will be uninterrupted.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Limitation of Liability</h2>
              <p>
                To the fullest extent permitted by law, Movora and its operators shall not be liable
                for any indirect, incidental, or consequential damages arising from your use of or
                inability to use the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Intellectual Property</h2>
              <p>
                All trademarks, logos, and content visible on Movora (excluding third-party content)
                are the property of Movora. Third-party titles, posters, and metadata belong to their
                respective copyright owners. We make no claim of ownership over such content.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Changes to Terms</h2>
              <p>
                We reserve the right to modify these terms at any time. Continued use of the service
                after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Contact</h2>
              <p>
                For any questions regarding these terms, contact us at{' '}
                <a href="mailto:help@watchmovora.com" className="text-primary hover:underline">help@watchmovora.com</a>.
              </p>
            </section>

          </div>
        </div>
      </div>
    </>
  )
}
