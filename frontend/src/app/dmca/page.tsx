import Sidebar from '@/components/Sidebar'

export const metadata = { title: 'DMCA Policy — Movora' }

export default function DMCAPage() {
  return (
    <>
      <Sidebar />
      <div className="min-h-screen lg:pl-24 pb-24 lg:pb-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-3xl font-bold text-foreground mb-2">DMCA Takedown Policy</h1>
          <p className="text-sm text-muted-foreground mb-10">Last updated: May 2026</p>

          <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground leading-relaxed">

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. About Movora</h2>
              <p>
                Movora is a search engine and aggregator that indexes publicly available streaming links
                from third-party websites. Movora does not host, upload, store, or transmit any video
                content on its servers. All media content is hosted and served exclusively by third-party
                platforms. Movora functions solely as an index of links, in the same manner as a search engine.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. DMCA Safe Harbor</h2>
              <p>
                Movora respects the intellectual property rights of others and complies with the Digital
                Millennium Copyright Act (DMCA), 17 U.S.C. § 512. If you believe that content linked
                through our service infringes your copyright, you may submit a takedown notice to our
                designated agent as described below.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. How to Submit a Takedown Notice</h2>
              <p>To be valid under DMCA § 512(c)(3), your notice must include:</p>
              <ul className="list-disc pl-6 mt-3 space-y-2">
                <li>Your physical or electronic signature (or that of an authorized agent).</li>
                <li>Identification of the copyrighted work you claim has been infringed.</li>
                <li>The specific URL(s) on Movora where the allegedly infringing link appears.</li>
                <li>Your contact information (name, address, phone number, email).</li>
                <li>A statement that you have a good-faith belief the use is not authorised by the copyright owner.</li>
                <li>A statement that the information in your notice is accurate and, under penalty of perjury, that you are authorised to act on behalf of the copyright owner.</li>
              </ul>
              <p className="mt-4">
                Send notices to: <a href="mailto:dmca@movora.online" className="text-primary hover:underline">dmca@movora.online</a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Our Response</h2>
              <p>
                Upon receipt of a valid takedown notice, we will remove or disable access to the
                reported link within 48–72 hours. We will also notify the user who submitted the
                content (if applicable) and may forward the notice to them.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Counter-Notice</h2>
              <p>
                If you believe your content was removed in error, you may submit a counter-notice
                under DMCA § 512(g)(3) to the same address. Upon receipt of a valid counter-notice,
                we may restore the link within 10–14 business days unless the complainant files a
                court action.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Repeat Infringers</h2>
              <p>
                Movora will terminate access for users or sources that are subject to repeated valid
                takedown notices, in accordance with DMCA § 512(i).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. India — IT Act Grievance Officer</h2>
              <p>
                In accordance with the Information Technology Act, 2000 and the Information Technology
                (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, our Grievance Officer is:
              </p>
              <div className="mt-3 p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <p><span className="text-foreground font-medium">Name:</span> Movora Support Team</p>
                <p><span className="text-foreground font-medium">Email:</span> <a href="mailto:grievance@movora.online" className="text-primary hover:underline">grievance@movora.online</a></p>
                <p><span className="text-foreground font-medium">Response time:</span> Within 24 hours of receipt of complaint</p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </>
  )
}
