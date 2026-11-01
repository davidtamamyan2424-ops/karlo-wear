import { Link } from "react-router-dom";
import heroImage from "../assets/karlo-hero.webp";
export default function HomePage() {
  return (
    <div className="kw-home animate-fade-in space-y-7">
      <section aria-label="Karlo Wear" className="relative isolate aspect-square overflow-hidden rounded-card bg-white">
        <img src={heroImage} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 flex justify-center px-5 pb-7 sm:pb-10">
          <Link to="/catalog" className="inline-block rounded-full bg-ink px-7 py-3 text-sm font-medium text-white shadow-[0_0_24px_8px_rgba(255,245,225,0.65)] ring-1 ring-white/60 transition hover:bg-neutral-800 hover:shadow-[0_0_28px_10px_rgba(255,245,225,0.8)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Смотреть каталог</Link>
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-xl font-semibold">Коллекция</h2>
        <div className="grid grid-cols-2 gap-3">
          {([["TSHIRT", "Футболки"], ["HOODIE", "Худи"], ["PANTS", "Брюки"]] as const).map(([category, label]) => (
            <Link key={category} to={`/catalog?category=${category}`} className="rounded-card border border-line bg-paper px-4 py-8 text-center font-medium text-ink">{label} →</Link>
          ))}
        </div>
      </section>
      <section className="rounded-card border border-line bg-paper p-6">
        <p className="text-xs uppercase tracking-widest text-muted">The set</p>
        <h2 className="mt-2 text-2xl font-semibold">Худи + брюки — скидка 10%</h2>
        <p className="mt-2 text-sm text-muted">Соберите комплект из любых моделей, цветов и размеров. Скидка автоматически появится в корзине.</p>
        <Link to="/catalog" className="mt-5 inline-block text-sm font-semibold underline underline-offset-4">Выбрать комплект →</Link>
      </section>
    </div>
  );
}
