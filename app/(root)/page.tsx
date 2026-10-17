import Link from "next/link";
import LiveCountries from "../components/LiveCountries";

export default function Home() {
  return (
    <div className="overflow-x-hidden pb-20">
      {/* La banderole : tendue d'un bord à l'autre, légèrement de travers. */}
      <section aria-labelledby="titre" className="pt-14 sm:pt-20 pb-10">
        <div className="-mx-4 -rotate-2 bg-rose border-y-[3px] border-encre px-8 py-6 sm:py-8">
          <h1 id="titre" className="display text-center text-encre text-[clamp(2.8rem,10vw,8.5rem)]">
            Qui manifeste, où, maintenant.
          </h1>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 grid gap-12 md:grid-cols-[1.1fr_1fr] md:gap-16">
        <section>
          <p className="text-xl leading-relaxed max-w-[34ch]">
            Cortège repère les manifestations, grèves et blocages signalés par la presse du monde entier, et les place
            sur une carte mise à jour toutes les 15 minutes.
          </p>
          <Link
            href="/manifestations"
            className="mt-8 inline-block rounded-[3px] border-[1.5px] border-encre bg-encre px-5 py-3 text-lg font-semibold text-papier shadow-[4px_4px_0_rgb(var(--rose))] hover:bg-bleu hover:border-bleu"
          >
            Ouvrir la carte
          </Link>
          <p className="mt-10 text-sm text-gris max-w-[46ch] leading-relaxed">
            Les données viennent de GDELT, qui analyse les articles de presse en continu. Une manifestation peu couverte
            par les médias peut ne pas apparaître.
          </p>
        </section>

        <section aria-labelledby="en-direct">
          <h2 id="en-direct" className="flex items-center gap-2.5 text-xl font-bold mb-3">
            <span className="live-dot" aria-hidden="true" />
            En ce moment
          </h2>
          <LiveCountries />
        </section>
      </div>
    </div>
  );
}
