// Sitewide JSON-LD (schema.org). Only facts that are visible on the site go here.

export const SITE_URL = 'https://orientacionolavarria.com.ar';
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const PRACTICE_ID = `${SITE_URL}/#practice`;
export const PERSON_ID = `${SITE_URL}/#pablo`;
export const DEFAULT_IMAGE = `${SITE_URL}/og.png`;

const INSTAGRAM = 'https://instagram.com/orientacionolav';

const website = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: `${SITE_URL}/`,
  name: 'Orientación Olavarría',
  alternateName: 'Orientación Vocacional Olavarría',
  inLanguage: 'es-AR',
  publisher: { '@id': PRACTICE_ID },
};

// Pablo chose: city only (no street address), by appointment only (no opening hours),
// WhatsApp number public but no email, fees on request (no priceRange). Google's
// optional-field warnings for those are expected.
const practice = {
  '@type': 'ProfessionalService',
  '@id': PRACTICE_ID,
  name: 'Orientación Olavarría',
  alternateName: 'Orientación Vocacional Olavarría',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Olavarría',
    addressRegion: 'Buenos Aires',
    addressCountry: 'AR',
  },
  telephone: '+54 9 2284 33-2382',
  description:
    'Espacio de orientación vocacional y ocupacional en Olavarría, con Pablo Ciocchini, psicólogo (M.P. 40361). Atención presencial y online.',
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/favicon.svg`,
  image: DEFAULT_IMAGE,
  founder: { '@id': PERSON_ID },
  employee: { '@id': PERSON_ID },
  areaServed: [
    { '@type': 'City', name: 'Olavarría', containedInPlace: { '@type': 'State', name: 'Buenos Aires' } },
    { '@type': 'Country', name: 'Argentina' },
  ],
  knowsAbout: ['Orientación vocacional', 'Orientación ocupacional', 'Elección de carrera'],
  sameAs: [INSTAGRAM],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    url: `${SITE_URL}/contacto/`,
    availableLanguage: 'es',
  },
};

const person = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Pablo Ciocchini',
  jobTitle: 'Psicólogo',
  url: `${SITE_URL}/sobre-mi/`,
  image: `${SITE_URL}/img/pablo.jpg`,
  alumniOf: { '@type': 'CollegeOrUniversity', name: 'Universidad Nacional de La Plata' },
  hasCredential: [
    { '@type': 'EducationalOccupationalCredential', credentialCategory: 'degree', name: 'Licenciatura en Psicología (UNLP, 2017)' },
    { '@type': 'EducationalOccupationalCredential', credentialCategory: 'license', name: 'Matrícula Provincial M.P. 40361' },
  ],
  knowsAbout: ['Orientación vocacional', 'Orientación ocupacional', 'Psicología'],
  worksFor: { '@id': PRACTICE_ID },
  sameAs: [INSTAGRAM],
};

/** WebSite + ProfessionalService + Person, as one @graph. */
export const siteGraph = {
  '@context': 'https://schema.org',
  '@graph': [website, practice, person],
};
