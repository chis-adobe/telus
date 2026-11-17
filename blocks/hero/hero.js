/**
 * Hero: splits authored content into a text column and an image column.
 * Accepts image + text in one cell or in separate cells.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const picture = block.querySelector('picture');
  const content = document.createElement('div');
  content.className = 'hero-content';

  [...block.querySelectorAll(':scope > div > div')].forEach((cell) => {
    [...cell.children].forEach((child) => {
      if (child === picture || child.contains(picture)) return;
      content.append(child);
    });
  });

  block.textContent = '';
  block.append(content);

  if (picture) {
    const media = document.createElement('div');
    media.className = 'hero-media';
    media.append(picture);
    const img = picture.querySelector('img');
    if (img) {
      img.loading = 'eager';
      img.fetchPriority = 'high';
    }
    block.append(media);
  }
}
