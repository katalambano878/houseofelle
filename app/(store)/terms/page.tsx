import PageHero from '@/components/PageHero';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <PageHero title="Terms and Conditions" subtitle="Please read these terms carefully before using our website and services." />

      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-12 md:py-20">
        <div className="max-w-[720px] mx-auto">
          <p className="text-sm text-[#6B565B] pb-8 mb-10 border-b border-[#1F1115]/14">Last updated: February 2026</p>
        <div>
          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">1. Agreement to Terms</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              By accessing and using this website (House of Elle), you accept and agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use our website or services.
            </p>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              These terms apply to all visitors, users, and customers who access or use our service. We reserve the right to update or modify these terms at any time without prior notice. Your continued use of the website following any changes indicates your acceptance of the new terms.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">2. Use of Website</h2>
            
            <h3 className="text-[17px] font-semibold text-[#1F1115] mb-3 mt-8">2.1 Permitted Use</h3>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              You may use our website for lawful purposes only. You agree not to:
            </p>
            <ul className="flex flex-col gap-2.5 text-[15px] md:text-base leading-[1.65] text-[#4D3A3F] mb-6">
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-close-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Violate any local, national, or international law or regulation</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-close-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Transmit any harmful code, viruses, or malicious software</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-close-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Attempt to gain unauthorised access to our systems or networks</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-close-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Use the website for fraudulent purposes or in connection with any criminal activity</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-close-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Impersonate any person or entity or misrepresent your affiliation</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-close-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Interfere with or disrupt the website or servers</span>
              </li>
            </ul>

            <h3 className="text-[17px] font-semibold text-[#1F1115] mb-3 mt-8">2.2 Account Responsibility</h3>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              If you create an account, you are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must notify us immediately of any unauthorised use of your account or any other security breach.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">3. Products & Pricing</h2>
            
            <h3 className="text-[17px] font-semibold text-[#1F1115] mb-3 mt-8">3.1 Product Information</h3>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              We make every effort to display our products accurately, including colours, descriptions, and specifications. However, we cannot guarantee that your device's display will accurately reflect product colours or that product descriptions are error-free.
            </p>

            <h3 className="text-[17px] font-semibold text-[#1F1115] mb-3 mt-8">3.2 Pricing</h3>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              All prices are listed in Ghana Cedis (GHS) and include VAT where applicable. We reserve the right to:
            </p>
            <ul className="flex flex-col gap-2.5 text-[15px] md:text-base leading-[1.65] text-[#4D3A3F] mb-6">
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Modify prices at any time without notice</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Correct pricing errors, even after an order is placed</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Limit quantities available for purchase</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Discontinue products at any time</span>
              </li>
            </ul>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              If a product is listed at an incorrect price due to an error, we will contact you before processing your order. You may choose to cancel the order or proceed at the correct price.
            </p>

            <h3 className="text-[17px] font-semibold text-[#1F1115] mb-3 mt-8">3.3 Availability</h3>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              Product availability is subject to change without notice. If an ordered item becomes unavailable, we will notify you and offer a refund or replacement option.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">4. Orders & Payment</h2>
            
            <h3 className="text-[17px] font-semibold text-[#1F1115] mb-3 mt-8">4.1 Order Acceptance</h3>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              Placing an order does not guarantee acceptance. We reserve the right to refuse or cancel any order for reasons including:
            </p>
            <ul className="flex flex-col gap-2.5 text-[15px] md:text-base leading-[1.65] text-[#4D3A3F] mb-6">
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Product unavailability or pricing errors</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Suspected fraudulent or unauthorised transactions</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Inaccuracies in product or pricing information</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Failure to meet age or eligibility requirements</span>
              </li>
            </ul>

            <h3 className="text-[17px] font-semibold text-[#1F1115] mb-3 mt-8">4.2 Payment</h3>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              We accept the following payment methods (we do not accept payment on delivery):
            </p>
            <div className="bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 md:p-6 rounded-[22px] mb-6">
              <ul className="flex flex-col gap-2.5 text-[15px] md:text-base leading-[1.65] text-[#4D3A3F]">
                <li className="flex items-center gap-2">
                  <i aria-hidden="true" className="ri-smartphone-line text-[#7A1F2E]"></i>
                  <span>Mobile Money (online checkout, via Moolre)</span>
                </li>
                <li className="flex items-center gap-2">
                  <i aria-hidden="true" className="ri-money-cny-circle-line text-[#7A1F2E]"></i>
                  <span>Cash or card (in store only)</span>
                </li>
              </ul>
            </div>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              Payment must be received in full before order dispatch. By providing payment information, you confirm that you are authorised to use the payment method and that there are sufficient funds available.
            </p>

            <h3 className="text-[17px] font-semibold text-[#1F1115] mb-3 mt-8">4.3 Order Modifications</h3>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              If you need to change or cancel an order, contact us as soon as possible. Orders that have already been dispatched cannot be changed.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">5. Shipping & Delivery</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              Delivery times and costs vary by location and shipping method selected. See our Shipping Policy for detailed information.
            </p>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              Risk of loss and title for products pass to you upon delivery to the carrier. We are not responsible for delays caused by the shipping carrier or circumstances beyond our control (weather, strikes, customs, etc.).
            </p>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              You must provide accurate and complete delivery information. We are not responsible for delivery failures due to incorrect addresses.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">6. Returns & Refunds</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              If an item arrives damaged, leaking or wrong, contact us as soon as possible through our Returns page and we will work out a replacement or refund with you.
            </p>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              Approved refunds are paid back to the Mobile Money number or payment method used for the order.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">7. Intellectual Property</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              All content on this website, including text, graphics, logos, images, videos, and software, is the property of House of Elle or its content suppliers and is protected by copyright, trademark, and other intellectual property laws.
            </p>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              You may not reproduce, distribute, modify, create derivative works of, publicly display, or otherwise use any content from this website without our express written permission.
            </p>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              Product names, logos, and brands are the property of their respective owners and are used for identification purposes only.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">8. User Content</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              You may submit reviews, comments, and other content to our website. By doing so, you grant us a non-exclusive, royalty-free, perpetual, worldwide licence to use, reproduce, modify, and display such content.
            </p>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              You are solely responsible for your content and must ensure it:
            </p>
            <ul className="flex flex-col gap-2.5 text-[15px] md:text-base leading-[1.65] text-[#4D3A3F] mb-6">
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-check-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Does not violate any laws or third-party rights</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-check-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Is not defamatory, offensive, or inappropriate</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-check-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Does not contain viruses or malicious code</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-check-line text-[#7A1F2E] mt-0.5 flex-none"></i>
                <span>Is truthful and based on your genuine experience</span>
              </li>
            </ul>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              We reserve the right to remove any content that violates these terms or that we deem inappropriate.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">9. Limitation of Liability</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              To the fullest extent permitted by law, House of Elle shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from:
            </p>
            <ul className="flex flex-col gap-2.5 text-[15px] md:text-base leading-[1.65] text-[#4D3A3F] mb-6">
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#6B565B] mt-0.5 flex-none"></i>
                <span>Your use or inability to use the website or services</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#6B565B] mt-0.5 flex-none"></i>
                <span>Unauthorised access to or alteration of your data</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#6B565B] mt-0.5 flex-none"></i>
                <span>Errors or omissions in website content</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#6B565B] mt-0.5 flex-none"></i>
                <span>Product defects or performance issues</span>
              </li>
              <li className="flex items-start gap-2">
                <i aria-hidden="true" className="ri-arrow-right-s-line text-[#6B565B] mt-0.5 flex-none"></i>
                <span>Delivery delays or failures</span>
              </li>
            </ul>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              Our total liability for any claim arising from your use of the website or purchase of products shall not exceed the amount you paid for the product or service in question.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">10. Indemnification</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              You agree to indemnify and hold harmless House of Elle, its affiliates, officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from your use of the website, violation of these terms, or infringement of any third-party rights.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">11. Governing Law & Disputes</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-4">
              These terms are governed by the laws of Ghana. Any disputes arising from these terms or your use of the website shall be subject to the exclusive jurisdiction of the courts of Ghana.
            </p>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              Before initiating any legal action, you agree to first contact us to seek resolution through informal negotiation.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">12. Severability</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F]">
              If any provision of these terms is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.
            </p>
          </section>

          <section className="py-10 md:py-12 border-t border-[#1F1115]/14 first:border-t-0 first:pt-0">
            <h2 className="font-serif text-[26px] md:text-[30px] leading-[1.1] tracking-[-0.01em] text-[#1F1115] mb-5">13. Contact Information</h2>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#4D3A3F] mb-6">
              For questions about these Terms and Conditions, please contact us:
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

          <div className="mt-4 bg-[#2B0B12] p-6 md:p-8 rounded-[24px] flex flex-col items-start gap-4">
            <i aria-hidden="true" className="ri-check-line text-2xl text-[#E5B65A]"></i>
            <p className="text-[15px] md:text-base leading-[1.75] text-[#E3CFC7]">
              By using our website, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
            </p>
          </div>
        </div>
      </div>
      </div>
    </main>
  );
}
