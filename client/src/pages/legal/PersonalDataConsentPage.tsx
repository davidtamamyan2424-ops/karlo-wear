import LegalPageLayout from "../../components/LegalPageLayout";
import { LEGAL } from "../../constants/legal";
import { ru } from "../../i18n/ru";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-ink">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function PersonalDataConsentPage() {
  return (
    <LegalPageLayout title={ru.legal.consentTitle}>
      <p>
        Настоящим я, оформляя заказ в интернет-магазине {LEGAL.brand}, свободно, своей волей
        и в своём интересе даю согласие {LEGAL.seller}, {LEGAL.sellerStatus.toLowerCase()}
        (далее — «Оператор»), на обработку моих персональных данных на условиях, изложенных
        ниже.
      </p>

      <Section title="1. Перечень персональных данных">
        <p>Согласие распространяется на обработку следующих персональных данных:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>фамилия, имя, отчество (при наличии) или указанное имя;</li>
          <li>номер телефона;</li>
          <li>имя пользователя Telegram;</li>
          <li>город, адрес доставки и иные сведения, необходимые для доставки;</li>
          <li>сведения о заказе и комментарии к заказу;</li>
          <li>иные данные, предоставленные мной при оформлении заказа.</li>
        </ul>
      </Section>

      <Section title="2. Цели обработки">
        <p>Персональные данные обрабатываются в целях:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>оформления и исполнения договора купли-продажи;</li>
          <li>организации доставки товара;</li>
          <li>связи со мной по вопросам заказа, оплаты и доставки;</li>
          <li>обработки возвратов и обращений;</li>
          <li>исполнения требований законодательства РФ.</li>
        </ul>
      </Section>

      <Section title="3. Действия с персональными данными">
        <p>
          Оператор вправе совершать следующие действия с персональными данными: сбор, запись,
          систематизацию, накопление, хранение, уточнение (обновление, изменение), извлечение,
          использование, передачу (предоставление, доступ) службам доставки в необходимом
          объёме, обезличивание, блокирование, удаление и уничтожение.
        </p>
        <p>
          Обработка может осуществляться как с использованием средств автоматизации, так и без
          их использования.
        </p>
      </Section>

      <Section title="4. Срок действия согласия">
        <p>
          Согласие действует с момента его предоставления до достижения целей обработки либо
          до момента отзыва согласия, если иное не предусмотрено законодательством Российской
          Федерации.
        </p>
      </Section>

      <Section title="5. Отзыв согласия">
        <p>
          Я уведомлён(а), что вправе отозвать настоящее согласие, направив письменное
          уведомление на адрес электронной почты{" "}
          <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-2">
            {LEGAL.email}
          </a>
          . Отзыв согласия не влияет на законность обработки, осуществлённой до его отзыва.
        </p>
      </Section>

      <Section title="6. Подтверждение">
        <p>
          Оформляя заказ и отмечая соответствующий пункт на странице оформления заказа, я
          подтверждаю, что ознакомлен(а) с{" "}
          <a href="/privacy" className="underline underline-offset-2">
            Политикой конфиденциальности
          </a>{" "}
          и{" "}
          <a href="/offer" className="underline underline-offset-2">
            Публичной офертой
          </a>
          , понимаю цели и объём обработки персональных данных и даю настоящее согласие.
        </p>
      </Section>

      <Section title="7. Контакты Оператора">
        <p>{LEGAL.seller}</p>
        <p>{LEGAL.sellerStatus}</p>
        <p>{LEGAL.city}</p>
        <p>
          E-mail:{" "}
          <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-2">
            {LEGAL.email}
          </a>
        </p>
        <p>
          Телефон:{" "}
          <a href={`tel:${LEGAL.phoneTel}`} className="underline underline-offset-2">
            {LEGAL.phone}
          </a>
        </p>
      </Section>
    </LegalPageLayout>
  );
}
