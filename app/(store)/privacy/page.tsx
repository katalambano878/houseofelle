import PageHero from '@/components/PageHero';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <PageHero title="Privacy Policy" subtitle="Your privacy matters to us. Learn how we collect, use, and protect your personal information." />

      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-12 md:py-20">
        <div className="max-w-[720px] mx-auto">
          <p className="text-sm text-[#6B565B] pb-8 mb-10 border-b border-[#1F1115]/14">Last updated: February 2026</p>
        <div>
          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">1. Information We Collect</h2>
            
            <h3 className="text-[17px] font-semibold text-[#1F1115] mb-3 mt-8">1.1 Information You Provide</h3>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              When you create an account, place an order, or contact us, we collect:
            </p>
            <ul className="flex flex-col gap-2.5 text-[15px] md:text-base leading-[1.65] text-[#4D3A3F] mb-6">
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-check-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span><strong>Personal Details:</strong> Name, email address, phone number, date of birth</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-check-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span><strong>Delivery Information:</strong> Shipping and billing addresses</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-check-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span><strong>Payment Details:</strong> Payment method information (securely processed by third-party providers)</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-check-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span><strong>Communications:</strong> Messages, reviews, and feedback you submit</span>
              </li>
            </ul>

            <h3 className="text-[17px] font-semibold text-[#1F1115] mb-3 mt-8">1.2 Information Collected Automatically</h3>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              When you visit our website, we automatically collect:
            </p>
            <ul className="flex flex-col gap-2.5 text-[15px] md:text-base leading-[1.65] text-[#4D3A3F] mb-6">
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-check-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-check-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span><strong>Usage Data:</strong> Pages viewed, products browsed, search queries, time spent on site</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-check-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span><strong>Cookies:</strong> Small data files stored on your device to improve your experience</span>
              </li>
            </ul>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">2. How We Use Your Information</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-6">
              We use your personal information for the following purposes:
            </p>
            
            <div className="space-y-6">
              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <h3 className="text-base font-semibold text-[#1F1115] mb-2 flex items-center gap-2">
                  <i aria-hidden="true" className="ri-shopping-bag-line text-[#7A1F2E]"></i>
                  Order Processing & Fulfilment
                </h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Process your orders, arrange delivery, send order confirmations and updates, handle returns and refunds, and provide customer support.
                </p>
              </div>

              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <h3 className="text-base font-semibold text-[#1F1115] mb-2 flex items-center gap-2">
                  <i aria-hidden="true" className="ri-line-chart-line text-[#7A1F2E]"></i>
                  Service Improvement
                </h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Analyse website usage to improve our products, services, and user experience. Conduct research and development for new features and offerings.
                </p>
              </div>

              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <h3 className="text-base font-semibold text-[#1F1115] mb-2 flex items-center gap-2">
                  <i aria-hidden="true" className="ri-mail-line text-[#7A1F2E]"></i>
                  Marketing & Communication
                </h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Send promotional emails, special offers, and product recommendations (only if you've opted in). Share relevant updates about your orders and our services.
                </p>
              </div>

              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <h3 className="text-base font-semibold text-[#1F1115] mb-2 flex items-center gap-2">
                  <i aria-hidden="true" className="ri-shield-check-line text-[#7A1F2E]"></i>
                  Security & Fraud Prevention
                </h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Protect against fraudulent transactions, unauthorised access, and other security threats. Verify your identity for high-value purchases.
                </p>
              </div>

              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <h3 className="text-base font-semibold text-[#1F1115] mb-2 flex items-center gap-2">
                  <i aria-hidden="true" className="ri-scales-line text-[#7A1F2E]"></i>
                  Legal Compliance
                </h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Comply with legal obligations, respond to lawful requests from authorities, enforce our terms and conditions, and resolve disputes.
                </p>
              </div>
            </div>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">3. Information Sharing & Disclosure</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-6">
              We do not sell your personal information. We may share your data with:
            </p>

            <div className="space-y-4">
              <div className="border-l-2 border-[#7A1F2E] pl-5">
                <h3 className="text-base font-semibold text-[#1F1115] mb-1.5">Service Providers</h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Trusted third parties who help us operate our business (payment processors, delivery partners, email service providers, analytics tools). They are contractually bound to protect your data.
                </p>
              </div>

              <div className="border-l-2 border-[#7A1F2E] pl-5">
                <h3 className="text-base font-semibold text-[#1F1115] mb-1.5">Business Transfers</h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  If we merge with or are acquired by another company, your information may be transferred as part of the transaction. We will notify you of any such change.
                </p>
              </div>

              <div className="border-l-2 border-[#7A1F2E] pl-5">
                <h3 className="text-base font-semibold text-[#1F1115] mb-1.5">Legal Requirements</h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  When required by law or to protect our rights, property, or safety, or that of our customers or others.
                </p>
              </div>

              <div className="border-l-2 border-[#7A1F2E] pl-5">
                <h3 className="text-base font-semibold text-[#1F1115] mb-1.5">With Your Consent</h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Any other disclosures will be made only with your explicit consent.
                </p>
              </div>
            </div>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">4. Data Security</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-6">
              We implement robust security measures to protect your personal information:
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <div className="w-11 h-11 bg-[#2B0B12] rounded-full flex items-center justify-center mb-4">
                  <i aria-hidden="true" className="ri-lock-line text-[#E5B65A] text-lg"></i>
                </div>
                <h3 className="text-base font-semibold text-[#1F1115] mb-1.5">Encryption</h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  All data transmitted between your browser and our servers is encrypted using SSL/TLS technology.
                </p>
              </div>

              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <div className="w-11 h-11 bg-[#2B0B12] rounded-full flex items-center justify-center mb-4">
                  <i aria-hidden="true" className="ri-shield-check-line text-[#E5B65A] text-lg"></i>
                </div>
                <h3 className="text-base font-semibold text-[#1F1115] mb-1.5">Secure Storage</h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Your data is stored on secure servers with restricted access and regular security audits.
                </p>
              </div>

              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <div className="w-11 h-11 bg-[#2B0B12] rounded-full flex items-center justify-center mb-4">
                  <i aria-hidden="true" className="ri-bank-card-line text-[#E5B65A] text-lg"></i>
                </div>
                <h3 className="text-base font-semibold text-[#1F1115] mb-1.5">Payment Security</h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Online payments are handled by Moolre, our Mobile Money provider. We never see or store your Mobile Money PIN.
                </p>
              </div>

              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <div className="w-11 h-11 bg-[#2B0B12] rounded-full flex items-center justify-center mb-4">
                  <i aria-hidden="true" className="ri-user-lock-line text-[#E5B65A] text-lg"></i>
                </div>
                <h3 className="text-base font-semibold text-[#1F1115] mb-1.5">Access Controls</h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Only authorised personnel have access to personal data, and they are bound by strict confidentiality obligations.
                </p>
              </div>
            </div>

            <div className="bg-[#E8C5BE] text-[#2B0B12] p-5 md:p-6 rounded-[22px] mt-6">
              <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                <strong className="text-[#1F1115]">Important:</strong> While we implement strong security measures, no method of transmission or storage is 100% secure. We cannot guarantee absolute security but continually work to protect your information.
              </p>
            </div>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">5. Your Rights & Choices</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-6">
              You have the following rights regarding your personal information:
            </p>

            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 bg-[#F1E8DC] rounded-full flex items-center justify-center flex-shrink-0">
                  <i aria-hidden="true" className="ri-eye-line text-[#7A1F2E]"></i>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1F1115] mb-1">Access</h3>
                  <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">Request a copy of the personal information we hold about you.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-9 h-9 bg-[#F1E8DC] rounded-full flex items-center justify-center flex-shrink-0">
                  <i aria-hidden="true" className="ri-pencil-line text-[#7A1F2E]"></i>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1F1115] mb-1">Correction</h3>
                  <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">Update or correct inaccurate or incomplete information.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-9 h-9 bg-[#F1E8DC] rounded-full flex items-center justify-center flex-shrink-0">
                  <i aria-hidden="true" className="ri-delete-bin-line text-[#7A1F2E]"></i>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1F1115] mb-1">Deletion</h3>
                  <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">Request deletion of your personal information (subject to legal retention requirements).</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-9 h-9 bg-[#F1E8DC] rounded-full flex items-center justify-center flex-shrink-0">
                  <i aria-hidden="true" className="ri-mail-close-line text-[#7A1F2E]"></i>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1F1115] mb-1">Marketing Opt-Out</h3>
                  <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">Unsubscribe from marketing emails at any time using the link in our emails or your account settings.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-9 h-9 bg-[#F1E8DC] rounded-full flex items-center justify-center flex-shrink-0">
                  <i aria-hidden="true" className="ri-download-line text-[#7A1F2E]"></i>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1F1115] mb-1">Data Portability</h3>
                  <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">Receive your data in a structured, commonly used format.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-9 h-9 bg-[#F1E8DC] rounded-full flex items-center justify-center flex-shrink-0">
                  <i aria-hidden="true" className="ri-hand-coin-line text-[#7A1F2E]"></i>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1F1115] mb-1">Object to Processing</h3>
                  <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">Object to certain types of data processing, such as direct marketing.</p>
                </div>
              </div>
            </div>

            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              To exercise any of these rights, please contact us at <a href="mailto:support@houseofelle.com" className="font-semibold text-[#7A1F2E] underline underline-offset-4 decoration-[#7A1F2E]/40 hover:decoration-[#7A1F2E]">support@houseofelle.com</a> or through your account settings. We will respond within 30 days.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">6. Cookies & Tracking</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-6">
              We use cookies and similar technologies to enhance your browsing experience:
            </p>

            <div className="space-y-4">
              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <h3 className="text-base font-semibold text-[#1F1115] mb-1.5">Essential Cookies</h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Required for the website to function properly (e.g., shopping cart, login sessions). These cannot be disabled.
                </p>
              </div>

              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <h3 className="text-base font-semibold text-[#1F1115] mb-1.5">Analytics Cookies</h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Help us understand how visitors use our website so we can improve it. These collect anonymous usage data.
                </p>
              </div>

              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <h3 className="text-base font-semibold text-[#1F1115] mb-1.5">Marketing Cookies</h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Used to show you relevant advertisements based on your interests. You can opt out of these through your browser settings.
                </p>
              </div>

              <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px]">
                <h3 className="text-base font-semibold text-[#1F1115] mb-1.5">Preference Cookies</h3>
                <p className="text-[15px] leading-[1.7] text-[#4D3A3F]">
                  Remember your preferences and settings (e.g., language, region) to provide a personalised experience.
                </p>
              </div>
            </div>

            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mt-6">
              You can control cookie preferences through your browser settings. However, disabling certain cookies may affect website functionality.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">7. Children's Privacy</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              Our website is not intended for children under 16 years of age. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, please contact us immediately and we will delete it.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">8. International Data Transfers</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              Your information may be transferred to and processed in countries outside Ghana, including countries that may have different data protection laws. We ensure appropriate safeguards are in place to protect your information in accordance with this privacy policy.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">9. Data Retention</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              We retain your personal information only for as long as necessary to fulfil the purposes outlined in this policy:
            </p>
            <ul className="flex flex-col gap-2.5 text-[15px] md:text-base leading-[1.65] text-[#4D3A3F]">
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span><strong>Account Information:</strong> Until you request deletion or close your account</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span><strong>Order History:</strong> 7 years for tax and accounting purposes</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span><strong>Marketing Data:</strong> Until you unsubscribe or request deletion</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span><strong>Analytics Data:</strong> Typically 26 months</span>
              </li>
            </ul>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">10. Changes to This Policy</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              We may update this privacy policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. We will notify you of significant changes by email or through a prominent notice on our website. The "Last updated" date at the top indicates when the policy was last revised.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">11. Contact Us</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-6">
              If you have any questions, concerns, or requests regarding this privacy policy or our data practices, please contact us:
            </p>

            <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-6 md:p-8 rounded-[24px]">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <i aria-hidden="true" className="ri-mail-line text-[#7A1F2E] text-xl mt-1"></i>
                  <div>
                    <p className="font-semibold text-[#1F1115]">Email</p>
                    <a href="mailto:support@houseofelle.com" className="font-semibold text-[#7A1F2E] underline underline-offset-4 decoration-[#7A1F2E]/40 hover:decoration-[#7A1F2E]">support@houseofelle.com</a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <i aria-hidden="true" className="ri-phone-line text-[#7A1F2E] text-xl mt-1"></i>
                  <div>
                    <p className="font-semibold text-[#1F1115]">Phone</p>
                    <a href="tel:0570551050" className="font-semibold text-[#7A1F2E] underline underline-offset-4 decoration-[#7A1F2E]/40 hover:decoration-[#7A1F2E]">0570551050</a> · WhatsApp <a href="https://wa.me/233570551050" className="font-semibold text-[#7A1F2E] underline underline-offset-4 decoration-[#7A1F2E]/40 hover:decoration-[#7A1F2E]">0570551050</a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <i aria-hidden="true" className="ri-map-pin-line text-[#7A1F2E] text-xl mt-1"></i>
                  <div>
                    <p className="font-semibold text-[#1F1115]">Address</p>
                    <p className="text-[#4D3A3F]">House of Elle<br />Spintex Lashibi, Shalom Spot Junction, Accra, Ghana</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      </div>
    </main>
  );
}
