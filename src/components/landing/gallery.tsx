import Image from "next/image";
import { PHOTOS } from "./photos";

const print =
  "border-[8px] border-bg bg-bg transition-transform duration-200 ease-[var(--ease-out)] hover:rotate-0 focus-within:rotate-0 lg:hover:rotate-0 lg:focus-within:rotate-0";

/**
 * Archival Lisbon dropped around WHERE NEXT like prints on a table. The prints frame the words and
 * never cover them, so the headline always reads in full.
 */
export function Gallery() {
  return (
    <section
      aria-labelledby="gallery-heading"
      className="relative flex flex-col items-center gap-10 overflow-hidden bg-surface px-5 py-16 lg:min-h-[100svh] lg:justify-center lg:py-0"
    >
      <h2
        id="gallery-heading"
        data-reveal
        className="relative z-10 text-center font-display text-[25vw] leading-[0.85] font-extrabold tracking-[-0.01em] text-ink uppercase md:text-[20vw] lg:text-[14vw]"
      >
        Where
        <br />
        next
      </h2>

      <div className="flex w-full justify-center gap-4 lg:contents">
        <figure
          data-reveal
          className={`${print} w-[44vw] -rotate-[6deg] lg:absolute lg:top-[10%] lg:left-[4vw] lg:w-[20vw] lg:-rotate-[8deg]`}
        >
          <Image
            src={PHOTOS.portEngraving}
            alt="Engraved 1790s plan of the port of Lisbon from Luffman's Select Plans"
            sizes="(min-width: 1024px) 20vw, 44vw"
            className="aspect-[3/4] h-auto w-full object-cover"
          />
        </figure>
        <figure
          data-reveal
          style={{ "--reveal-index": 1 } as React.CSSProperties}
          className={`${print} mt-8 w-[44vw] rotate-[5deg] lg:absolute lg:right-[4vw] lg:bottom-[12%] lg:mt-0 lg:w-[24vw] lg:rotate-[6deg]`}
        >
          <Image
            src={PHOTOS.rooftops}
            alt="Alfama's terracotta rooftops running down to the Tagus"
            sizes="(min-width: 1024px) 24vw, 44vw"
            className="aspect-[4/3] h-auto w-full object-cover"
          />
        </figure>
      </div>
      <figure
        data-reveal
        style={{ "--reveal-index": 2 } as React.CSSProperties}
        className={`${print} hidden w-[15vw] rotate-[3deg] lg:absolute lg:top-[8%] lg:right-[9vw] lg:block`}
      >
        <Image
          src={PHOTOS.baixaMap}
          alt="1756 plan for rebuilding Lisbon's Baixa after the earthquake"
          sizes="15vw"
          className="aspect-[4/3] h-auto w-full object-cover"
        />
      </figure>

      <p className="max-w-[34ch] self-start text-ui text-ink lg:absolute lg:bottom-6 lg:left-16">
        Every trip starts with one picture you can&apos;t stop looking at.
      </p>
    </section>
  );
}
