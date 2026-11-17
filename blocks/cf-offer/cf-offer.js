/*
 * cf-offer — renders one TELUS offer from an AEM Content Fragment.
 *
 * Authoring: the block holds ONLY the Content Fragment path, e.g.
 *   | cf-offer                                  |
 *   | /content/dam/telus/en/offers/black-friday |
 *
 * The block builds the persisted GraphQL request from that path, then maps the
 * returned fields (offerTitle, campaign, headline, description, ctaLabel,
 * ctaUrl, asset) into the offer card. No offer copy or imagery lives in code.
 * Layout across several offers is owned by the section (e.g. "offers-grid").
 */

/** AEM publish tier serving the persisted queries and assets. */
const AEM_PUBLISH_HOST = 'https://publish-p153659-e1614585.adobeaemcloud.com';
/** Persisted query: {configuration}/{query name}. */
const PERSISTED_QUERY = 'ref-demo-eds/getTelusOffer';
/** Only DAM paths made of safe characters are accepted. */
const CF_PATH_PATTERN = /\/content\/dam\/[\w\-/.]+/;
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Finds the Content Fragment path authored in the block.
 * Accepts plain text, a link, or a full AEM URL that contains the DAM path.
 * @param {Element} block
 * @returns {string|null}
 */
function readFragmentPath(block) {
  const candidates = [
    ...[...block.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
    block.textContent,
  ];
  const match = candidates
    .map((value) => {
      try {
        return decodeURIComponent(value || '');
      } catch {
        return value || '';
      }
    })
    .map((value) => value.match(CF_PATH_PATTERN))
    .find(Boolean);
  if (!match) return null;
  // drop a trailing extension or slash (e.g. ".html" from a copied author URL)
  return match[0].replace(/\.html$/, '').replace(/\/+$/, '').replace(/\.\./g, '');
}

/**
 * @param {string} path Content Fragment path
 * @returns {string} persisted query URL
 */
export function buildQueryUrl(path) {
  return `${AEM_PUBLISH_HOST}/graphql/execute.json/${PERSISTED_QUERY};path=${path}`;
}

/**
 * Fetches the offer fragment.
 * @param {string} path Content Fragment path
 * @returns {Promise<object|null>} the fragment item
 */
async function fetchOffer(path) {
  const resp = await fetch(buildQueryUrl(path), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`GraphQL request failed: ${resp.status}`);
  const json = await resp.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  const data = json.data || {};
  // first "...ByPath" result (telusOfferByPath)
  const byPath = Object.values(data).find((v) => v && typeof v === 'object' && 'item' in v);
  return byPath?.item || null;
}

/**
 * Normalises a text or rich-text CF field to plain text.
 * @param {string|object} value
 * @returns {string}
 */
function toText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value.plaintext === 'string') return value.plaintext.trim();
  if (typeof value.html === 'string') {
    return new DOMParser().parseFromString(value.html, 'text/html').body.textContent.trim();
  }
  return '';
}

/**
 * Resolves the image URL of an AEM asset reference returned by GraphQL.
 * Prefers Dynamic Media (_dynamicUrl, resized + webp), then the publish URL.
 * @param {object} asset
 * @returns {string|null}
 */
function resolveAssetUrl(asset) {
  if (!asset) return null;
  let url = null;
  if (asset._dynamicUrl) {
    const dynamic = new URL(asset._dynamicUrl, AEM_PUBLISH_HOST);
    dynamic.searchParams.set('width', '800');
    dynamic.searchParams.set('preferwebp', 'true');
    url = dynamic.href;
  } else if (asset._publishUrl) {
    url = asset._publishUrl;
  } else if (asset._path) {
    url = new URL(asset._path, AEM_PUBLISH_HOST).href;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Only allow http(s) and site-relative CTA links.
 * @param {string} href
 * @returns {string|null}
 */
function safeHref(href) {
  if (!href) return null;
  try {
    const url = new URL(href, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * Builds the offer card from the fragment data (telus.com offer tile):
 *   campaign → eyebrow label, headline → title, description → body text,
 *   asset → product image (alt = offerTitle), ctaUrl → link on the whole card.
 * ctaLabel is not displayed (the tile itself is the call to action).
 * @param {object} offer
 * @returns {Element}
 */
function renderOffer(offer) {
  const offerTitle = toText(offer.offerTitle);
  const campaign = toText(offer.campaign);
  const headline = toText(offer.headline);
  const description = toText(offer.description);
  const ctaHref = safeHref(toText(offer.ctaUrl));
  const imageUrl = resolveAssetUrl(offer.asset);

  const card = el(ctaHref ? 'a' : 'div', 'cf-offer-card');
  if (ctaHref) card.href = ctaHref;

  const body = el('div', 'cf-offer-body');
  if (campaign) body.append(el('p', 'cf-offer-campaign', campaign));
  if (headline) body.append(el('h3', 'cf-offer-headline', headline));
  if (description) body.append(el('p', 'cf-offer-description', description));
  card.append(body);

  if (imageUrl) {
    const media = el('div', 'cf-offer-media');
    const picture = document.createElement('picture');
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = offerTitle;
    img.loading = 'lazy';
    img.decoding = 'async';
    picture.append(img);
    media.append(picture);
    card.append(media);
  }

  return card;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const path = readFragmentPath(block);
  block.textContent = '';

  if (!path) {
    block.dataset.status = 'error';
    // eslint-disable-next-line no-console
    console.warn('cf-offer: no Content Fragment path (/content/dam/...) authored');
    return;
  }

  block.dataset.cfPath = path;
  block.dataset.status = 'loading';
  block.setAttribute('aria-busy', 'true');

  try {
    const offer = await fetchOffer(path);
    if (!offer) throw new Error('Content Fragment not found');
    block.append(renderOffer(offer));
    block.dataset.status = 'loaded';
  } catch (error) {
    block.dataset.status = 'error';
    // eslint-disable-next-line no-console
    console.error(`cf-offer: could not load ${path}`, error);
  } finally {
    block.removeAttribute('aria-busy');
  }
}
