const NOTES = ['Oud', 'Saffron', 'Rose', 'Vanilla', 'Amber', 'Musk', 'Bergamot'];

/** Scrolling band of the notes you find on our shelf. Stills for reduced motion. */
export default function NotesTicker() {
  const loop = [...NOTES, ...NOTES, ...NOTES];
  return (
    <section aria-label={`Notes you will find in our scents: ${NOTES.join(', ')}`} className="group overflow-hidden py-5 md:py-7 border-b border-[#1F1115]/12 bg-[#F1E8DC]">
      <div aria-hidden="true" className="flex w-max animate-[hoe-marquee_40s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[...loop, ...loop].map((n, i) => (
          <span key={i} className="inline-flex items-center gap-8 md:gap-10 pr-8 md:pr-10 whitespace-nowrap">
            <span className="font-serif italic text-[26px] md:text-[34px] text-[#4A1520]">{n}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#D9A441"><path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" /></svg>
          </span>
        ))}
      </div>
    </section>
  );
}
