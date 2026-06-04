export interface SetAttributesToChildsProps {
  selector: string;
  attribute: string;
  value: string | number | boolean | (() => (string | number | boolean));
}

/**
 * Svelte action that sets an HTML attribute on every matching descendant of `node`.
 * Useful for bulk-setting `aria-*` or `data-*` attributes on dynamic child lists.
 *
 * @param node - The host element whose descendants will be queried.
 * @param params - `selector` to match descendants, `attribute` name, and `value` (static or factory fn).
 */
export function setAttributesToChilds(node: HTMLElement, { selector, attribute, value }: SetAttributesToChildsProps) {
  node.querySelectorAll(selector).forEach(child => {
    const attributeValue = typeof value === 'function' ? value() : value;
    child.setAttribute(attribute, attributeValue.toString());
  });
}