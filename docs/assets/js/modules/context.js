/* Shared page context */

const body = document.body;
const base = (body?.getAttribute("data-base") || ".").trim();

export { base, body };
