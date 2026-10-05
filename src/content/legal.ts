import { siteConfig } from '@/config/site';
import type { Locale } from '@/i18n/routing';

/**
 * Legal copy.
 *
 * Kept as structured data rather than prose inside components so a fork can
 * replace it without touching JSX, and so both languages stay visibly in sync.
 *
 * This is a starting point drafted around how the template actually behaves —
 * device-local favourites, hashed IPs, EU-hosted data. Have a lawyer review it
 * before launch; it is not legal advice.
 */

export type LegalSection = {
  readonly heading: string;
  readonly paragraphs: readonly string[];
};

export type LegalDocument = {
  readonly title: string;
  readonly updated: string;
  readonly sections: readonly LegalSection[];
};

const UPDATED = '2026-01-01';

const privacyBg: LegalDocument = {
  title: 'Политика за поверителност',
  updated: UPDATED,
  sections: [
    {
      heading: 'Кой обработва данните ти',
      paragraphs: [
        `Администратор на лични данни е ${siteConfig.legalName}, с адрес ${siteConfig.offices[0]?.address.bg ?? ''}, ${siteConfig.offices[0]?.city.bg ?? ''}.`,
        `За въпроси относно личните ти данни пиши на ${siteConfig.contact.email}.`,
      ],
    },
    {
      heading: 'Какви данни събираме',
      paragraphs: [
        'Когато изпратиш запитване, събираме името, имейла, телефона (ако си го посочил) и текста на съобщението. Тези данни са необходими, за да отговорим.',
        'Записваме и необратим криптографски отпечатък на IP адреса ти, за да ограничим злоупотреби. Самият IP адрес не се съхранява.',
        'Сайтът не изисква регистрация. Списъкът ти с любими имоти се пази единствено в браузъра на устройството ти и никога не достига до нашите сървъри.',
      ],
    },
    {
      heading: 'Бисквитки',
      paragraphs: [
        'Използваме само технически необходими бисквитки, за да работи сайтът. Аналитични бисквитки не се поставят, докато не дадеш изрично съгласие чрез банера.',
        'Съгласието си можеш да оттеглиш по всяко време, като изчистиш данните на сайта в настройките на браузъра си.',
      ],
    },
    {
      heading: 'Къде се съхраняват данните',
      paragraphs: [
        'Базата данни, файловото хранилище и сървърите за приложението се намират в Европейския съюз.',
        'Обработващи лица са само доставчиците на хостинг, база данни и имейл услуги, с които имаме сключени договори по чл. 28 от GDPR.',
      ],
    },
    {
      heading: 'Колко дълго пазим данните',
      paragraphs: [
        'Запитванията се съхраняват до 24 месеца след последната комуникация, след което се изтриват или анонимизират.',
        'Записите в журнала на административните промени се пазят 12 месеца с цел проследимост и сигурност.',
      ],
    },
    {
      heading: 'Твоите права',
      paragraphs: [
        'Имаш право на достъп, коригиране, изтриване, ограничаване на обработването, преносимост и възражение.',
        `Изпрати искане на ${siteConfig.contact.email} — отговаряме в срок до един месец.`,
        'Имаш право и на жалба до Комисията за защита на личните данни.',
      ],
    },
  ],
};

const privacyEn: LegalDocument = {
  title: 'Privacy policy',
  updated: UPDATED,
  sections: [
    {
      heading: 'Who processes your data',
      paragraphs: [
        `The data controller is ${siteConfig.legalName}, ${siteConfig.offices[0]?.address.en ?? ''}, ${siteConfig.offices[0]?.city.en ?? ''}.`,
        `For any question about your personal data, write to ${siteConfig.contact.email}.`,
      ],
    },
    {
      heading: 'What we collect',
      paragraphs: [
        'When you send an enquiry we collect your name, email address, phone number if you provide one, and the message itself. We need these in order to reply.',
        'We also store a one-way cryptographic hash of your IP address so we can limit abuse. The address itself is never stored.',
        'The site requires no account. Your list of favourite properties is kept solely in your browser and never reaches our servers.',
      ],
    },
    {
      heading: 'Cookies',
      paragraphs: [
        'We set only the cookies strictly necessary for the site to work. No analytics cookies are set until you give explicit consent through the banner.',
        'You can withdraw consent at any time by clearing this site\u2019s data in your browser settings.',
      ],
    },
    {
      heading: 'Where the data lives',
      paragraphs: [
        'The database, the file storage and the application servers are all located in the European Union.',
        'The only processors involved are our hosting, database and email providers, each under a GDPR Article 28 agreement.',
      ],
    },
    {
      heading: 'How long we keep it',
      paragraphs: [
        'Enquiries are retained for up to 24 months after the last contact, then deleted or anonymised.',
        'Administrative audit entries are retained for 12 months for traceability and security.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'You have the right of access, rectification, erasure, restriction, portability and objection.',
        `Send your request to ${siteConfig.contact.email} — we respond within one month.`,
        'You also have the right to lodge a complaint with the Bulgarian Commission for Personal Data Protection.',
      ],
    },
  ],
};

const termsBg: LegalDocument = {
  title: 'Общи условия',
  updated: UPDATED,
  sections: [
    {
      heading: 'Предмет',
      paragraphs: [
        `Тези условия уреждат ползването на сайта на ${siteConfig.legalName}. С използването на сайта приемаш условията по-долу.`,
      ],
    },
    {
      heading: 'Информация за имотите',
      paragraphs: [
        'Публикуваните обяви са с информативен характер и не представляват публична оферта по смисъла на закона.',
        'Полагаме разумни усилия данните да са точни и актуални, но цени, наличност и характеристики могат да се променят без предизвестие. Преди сделка данните се потвърждават писмено.',
        'Показаната цена на квадратен метър е изчислена автоматично и е ориентировъчна.',
      ],
    },
    {
      heading: 'Кредитен калкулатор',
      paragraphs: [
        'Калкулаторът дава ориентировъчна вноска при въведени от теб параметри. Той не е предложение за кредит и не обвързва нито нас, нито банка.',
      ],
    },
    {
      heading: 'Интелектуална собственост',
      paragraphs: [
        'Снимките, текстовете и оформлението на сайта са защитени. Възпроизвеждането им без писмено разрешение не е позволено.',
      ],
    },
    {
      heading: 'Отговорност',
      paragraphs: [
        'Не носим отговорност за вреди, произтичащи от временна недостъпност на сайта или от решения, взети единствено въз основа на публикуваната тук информация.',
      ],
    },
  ],
};

const termsEn: LegalDocument = {
  title: 'Terms of use',
  updated: UPDATED,
  sections: [
    {
      heading: 'Scope',
      paragraphs: [
        `These terms govern the use of the ${siteConfig.legalName} website. By using the site you accept them.`,
      ],
    },
    {
      heading: 'Property information',
      paragraphs: [
        'Listings are published for information only and do not constitute a binding offer.',
        'We make reasonable efforts to keep details accurate and current, but prices, availability and specifications may change without notice. Details are confirmed in writing before any transaction.',
        'The price per square metre shown is calculated automatically and is indicative.',
      ],
    },
    {
      heading: 'Mortgage calculator',
      paragraphs: [
        'The calculator returns an indicative payment for the figures you enter. It is not a credit offer and binds neither us nor any bank.',
      ],
    },
    {
      heading: 'Intellectual property',
      paragraphs: [
        'Photographs, text and the design of this site are protected. Reproducing them without written permission is not permitted.',
      ],
    },
    {
      heading: 'Liability',
      paragraphs: [
        'We are not liable for damages arising from temporary unavailability of the site, or from decisions taken solely on the basis of the information published here.',
      ],
    },
  ],
};

export const legalDocuments: Record<'privacy' | 'terms', Record<Locale, LegalDocument>> = {
  privacy: { bg: privacyBg, en: privacyEn },
  terms: { bg: termsBg, en: termsEn },
};
