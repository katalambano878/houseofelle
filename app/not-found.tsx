import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col bg-[#2B0B12] text-[#F6EDE3]">
      <div className="max-w-[1280px] w-full mx-auto px-5 sm:px-8 lg:px-12 pt-6 md:pt-8">
        <Link href="/" aria-label="House of Elle home" className="inline-flex items-center min-h-[44px]">
          <img src="/house-of-elle-logo.png" alt="House of Elle" width={368} height={137} className="h-9 lg:h-11 w-auto brightness-0 invert-[.94] sepia-[.2]" />
        </Link>
      </div>

      <section className="flex-1 w-full max-w-[1100px] mx-auto px-5 pt-14 pb-20 md:pt-20 md:pb-24 flex flex-col items-center justify-center gap-6 text-center">
        <p aria-hidden="true" className="font-serif text-[110px] md:text-[160px] leading-[0.8] tracking-[-0.02em] text-[#6E2232] select-none">
          404
        </p>
        <h1 className="font-serif text-[40px] md:text-[48px] leading-none tracking-[-0.02em] text-balance">
          This scent has <em className="text-[#E5B65A]">faded.</em>
        </h1>
        <p className="max-w-[460px] text-[15px] md:text-base leading-[1.65] text-[#E3CFC7]">
          We can&apos;t find that page. It may have moved, or the bottle may have sold out.
        </p>

        <form role="search" action="/shop" method="get" className="w-full max-w-[460px] mt-2">
          <div className="flex items-center gap-3 h-[54px] pl-5 pr-2 rounded-full bg-[#F6EDE3]/[0.08] shadow-[inset_0_0_0_1px_rgba(246,237,227,0.22)] focus-within:shadow-[inset_0_0_0_1.5px_#D9A441]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CDB5AD" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M20 20l-4-4" />
            </svg>
            <label htmlFor="nf-search" className="sr-only">Search for a scent</label>
            <input
              id="nf-search"
              type="search"
              name="search"
              required
              placeholder="Search for a scent"
              className="flex-1 min-w-0 bg-transparent text-[16px] text-[#F6EDE3] placeholder:text-[#CDB5AD] outline-none"
            />
            <button
              type="submit"
              className="h-11 px-4 rounded-full bg-[#D9A441] text-[#2B0B12] text-[14px] font-bold hover:bg-[#E5B65A] transition-colors motion-reduce:transition-none"
            >
              Search
            </button>
          </div>
        </form>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex items-center min-h-[50px] px-6 rounded-full shadow-[inset_0_0_0_1px_rgba(246,237,227,0.35)] text-[15px] font-semibold hover:bg-[#F6EDE3]/10 transition-colors motion-reduce:transition-none">
            Back to home
          </Link>
          <Link href="/shop" className="inline-flex items-center min-h-[50px] px-6 rounded-full shadow-[inset_0_0_0_1px_rgba(246,237,227,0.35)] text-[15px] font-semibold hover:bg-[#F6EDE3]/10 transition-colors motion-reduce:transition-none">
            Browse the shop
          </Link>
        </div>
      </section>
    </main>
  );
}
