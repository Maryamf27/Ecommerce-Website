import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ProductDescription from "../components/ProductDescription";
import { getDescriptionView } from "../lib/description";

const long = Array.from({ length: 60 }, (_, index) => `word${index}`).join(" "); // well over 280 characters
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("getDescriptionView", () => {
  it("shows short descriptions in full with no toggle", () => {
    const exactly280 = "a".repeat(280);
    assert.deepEqual(getDescriptionView("Short text", false), { text: "Short text", collapsible: false });
    assert.deepEqual(getDescriptionView(exactly280, false), { text: exactly280, collapsible: false });
    assert.equal(getDescriptionView("x".repeat(281), false).collapsible, true);
  });
  it("truncates long descriptions at a word boundary with an ellipsis, then expands to the same full text", () => {
    const collapsed = getDescriptionView(long, false);
    assert.ok(collapsed.text.endsWith("…") && collapsed.text.length <= 281);
    assert.ok(long.startsWith(collapsed.text.slice(0, -1)));
    assert.ok(!/\s…$/.test(collapsed.text));
    assert.deepEqual(getDescriptionView(long, true), { text: long, collapsible: true });
  });
  it("trims surrounding whitespace before measuring", () => {
    assert.equal(getDescriptionView(`   ${"a".repeat(280)}   `, false).collapsible, false);
  });
});

describe("ProductDescription", () => {
  it("renders the description once, collapsed, with a 'Read full description' control", () => {
    const html = renderToStaticMarkup(<ProductDescription description={long} />);
    assert.equal(count(html, "<p"), 1);
    assert.equal(count(html, "word0"), 1);
    assert.equal(count(html, "word59"), 0);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, />Read full description</);
    assert.equal(count(html, "<details"), 0);
  });
  it("renders the full text once when expanded, with a 'Show less' control", () => {
    const html = renderToStaticMarkup(<ProductDescription description={long} initiallyExpanded />);
    assert.equal(count(html, "<p"), 1);
    assert.equal(count(html, "word0"), 1);
    assert.equal(count(html, "word59"), 1);
    assert.match(html, /aria-expanded="true"/);
    assert.match(html, />Show less</);
    assert.ok(html.includes(long));
  });
  it("links the toggle to the paragraph it controls", () => {
    const html = renderToStaticMarkup(<ProductDescription description={long} />);
    const id = /<p class="product-description" id="([^"]+)"/.exec(html)?.[1];
    assert.ok(id);
    assert.ok(html.includes(`aria-controls="${id}"`));
  });
  it("shows no toggle for short descriptions", () => {
    const html = renderToStaticMarkup(<ProductDescription description="A short description." />);
    assert.equal(count(html, "<button"), 0);
    assert.match(html, /A short description\./);
  });
});
