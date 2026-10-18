import { Link } from "react-router-dom";
import ThreadOrnament from "../components/ThreadOrnament";
export default function HomePage() {
  return (
    <div className="animate-fade-in space-y-7">
      <div className="kw-thread-stage" aria-hidden="true"><ThreadOrnament side="left" /><ThreadOrnament side="right" /></div>
      <section className="relative isolate overflow-hidden rounded-card bg-surface px-6 py-20 text-center">
        <div className="kw-hero-mark" aria-hidden="true">✦</div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Karlo Wear / Unisex</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink">Нити истории. Свобода формы.</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted">Современные силуэты, восточные мотивы и свобода быть собой.</p>
        <Link to="/catalog" className="mt-8 inline-block rounded-full bg-ink px-7 py-3 text-sm font-medium text-white">Смотреть каталог →</Link>
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
