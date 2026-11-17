import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { resolveContentPath } from '../../scripts/scripts.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

/**
 * Opens/closes the mobile menu.
 * @param {Element} nav
 * @param {boolean|null} forceExpanded
 */
function toggleMenu(nav, forceExpanded = null) {
  const expanded = forceExpanded !== null
    ? forceExpanded
    : nav.getAttribute('aria-expanded') !== 'true';
  nav.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  document.body.style.overflowY = expanded && !isDesktop.matches ? 'hidden' : '';
  const button = nav.querySelector('.nav-hamburger button');
  if (button) button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

/**
 * loads and decorates the header (TELUS: utility bar + main nav bar)
 *
 * Header fragment sections, in order:
 *   1. utility  – audience links (left list) and service links (right list)
 *   2. brand    – logo link
 *   3. sections – main navigation links
 *   4. tools    – call-to-action links (e.g. My TELUS)
 * With only three sections the utility bar is omitted.
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);
  if (!fragment) return;

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const names = nav.children.length >= 4
    ? ['utility', 'brand', 'sections', 'tools']
    : ['brand', 'sections', 'tools'];
  names.forEach((name, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${name}`);
  });

  // nav links are plain links, except the tools CTA which stays a button
  nav.querySelectorAll('.nav-utility .button, .nav-brand .button, .nav-sections .button').forEach((a) => {
    a.className = '';
    const wrapper = a.closest('.button-wrapper');
    if (wrapper) wrapper.className = '';
  });

  // site-relative links (e.g. the logo's home link) work in local preview too
  nav.querySelectorAll('a[href^="/"]').forEach((a) => {
    a.setAttribute('href', resolveContentPath(a.getAttribute('href')));
  });

  // highlight the current section link
  nav.querySelectorAll('.nav-utility a[href], .nav-sections a[href]').forEach((a) => {
    const url = new URL(a.href, window.location.href);
    if (url.pathname === window.location.pathname) a.setAttribute('aria-current', 'page');
  });

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.className = 'nav-hamburger';
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-controls', 'nav');
  button.setAttribute('aria-label', getMetadata('nav-menu-label') || 'Menu');
  button.append(document.createElement('span'));
  button.firstElementChild.className = 'nav-hamburger-icon';
  button.addEventListener('click', () => toggleMenu(nav));
  hamburger.append(button);
  nav.prepend(hamburger);

  toggleMenu(nav, false);
  isDesktop.addEventListener('change', () => toggleMenu(nav, false));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && nav.getAttribute('aria-expanded') === 'true') {
      toggleMenu(nav, false);
      button.focus();
    }
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
