export interface SetAttributesToChildsProps {
  selector: string;
  attribute: string;
  value: string | number | boolean | (() => (string | number | boolean));
}

export function setAttributesToChilds(node: HTMLElement, { selector, attribute, value }: SetAttributesToChildsProps) {
  node.querySelectorAll(selector).forEach(child => {
    const attributeValue = typeof value === 'function' ? value() : value;
    child.setAttribute(attribute, attributeValue.toString());
  });
}