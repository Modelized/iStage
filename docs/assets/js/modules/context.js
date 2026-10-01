const body = document.body;
const base = (body?.getAttribute("data-base") || ".").trim();
const assetVersion = "20260922h";

export { base, assetVersion, body };
