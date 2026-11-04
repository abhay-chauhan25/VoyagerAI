import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/brand/mark";
import tiles from "../../../public/images/landing/azulejo-museum.jpg";

/** Auth screens: a reading column beside a fixed picture, the same split the landing page opens with. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <Link href="/" className="self-start rounded-control text-ink" aria-label="Voyager home">
          <Wordmark />
        </Link>
        <main className="flex flex-1 items-center py-12">
          <div className="w-full max-w-[26rem]">{children}</div>
        </main>
      </div>
      <figure className="relative hidden lg:block">
        <div className="sticky top-0 h-svh">
          <Image
            src={tiles}
            alt="Blue and green geometric azulejo tiles at the National Tile Museum, Lisbon"
            fill
            priority
            sizes="50vw"
            className="object-cover"
            placeholder="blur"
          />
          <figcaption className="absolute inset-x-0 bottom-0 flex justify-between bg-bg px-6 py-4 text-ui text-ink">
            <span>Museu Nacional do Azulejo</span>
            <span className="tabular-nums">38.725° N, 9.114° W</span>
          </figcaption>
        </div>
      </figure>
    </div>
  );
}
