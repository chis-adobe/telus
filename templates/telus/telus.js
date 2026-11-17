/**
 * TELUS page template.
 *
 * Every page with "Template: telus" in its metadata gets the shared TELUS
 * header and footer fragments. A page can still point to other fragments by
 * setting its own "nav" / "footer" metadata.
 */
const FRAGMENTS = {
  nav: '/fragments/header',
  footer: '/fragments/footer',
};

/** Local previews serve content under /content/; Edge Delivery serves it from the root. */
function contentPath(path) {
  return window.location.pathname.startsWith('/content/') ? `/content${path}` : path;
}

function ensureMeta(name, content) {
  if (document.head.querySelector(`meta[name="${name}"]`)) return;
  const meta = document.createElement('meta');
  meta.name = name;
  meta.content = content;
  document.head.append(meta);
}

export default function decorate() {
  Object.entries(FRAGMENTS).forEach(([name, path]) => ensureMeta(name, contentPath(path)));
}
