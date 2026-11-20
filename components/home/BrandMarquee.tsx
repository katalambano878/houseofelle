const BRANDS = ['Lattafa', 'Khadlaj', 'Armaf', 'Riiffs', 'Ard Al Zafaran', 'Le Falcone'];

/** The houses on our shelf, scrolling slowly. Stills for reduced motion. */
export default function BrandMarquee() {
  const loop = [...BRANDS, ...BRANDS, ...BRANDS, ...BRANDS];
  return (
    <section aria-label={`Brands on our shelf: ${BRANDS.join(', ')}`} className="group bg-[#F5EDE4] border-b border-[#221B16]/10 overflow-hidden py-5 md:py-8 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div aria-hidden="true" className="flex w-max animate-[hoe-marquee_32s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {loop.map((b, i) => (
          <span key={i} className="inline-flex items-center gap-8 md:gap-12 pr-8 md:pr-12 whitespace-nowrap">
            <span className="font-serif italic text-2xl md:text-[34px] text-[#3A2F27]">{b}</span>
            <span className="w-2 h-2 rounded-full bg-[#C89B3C]" />
          </span>
        ))}
      </div>
    </section>
  );
}
