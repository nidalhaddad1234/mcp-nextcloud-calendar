/**
 * XML Document Builder with fluent API
 */
import { XmlService } from './xml-service.js';

/**
 * Builds XML documents with a fluent API
 */
export class XmlDocumentBuilder {
  private service: XmlService;
  private rootElementName: string;
  private namespaces: Record<string, string>;
  private currentElement: ElementNode;
  private rootElement: ElementNode;
  private isDisposed: boolean;

  /**
   * Creates a new XML document builder
   *
   * @param service XML service instance
   * @param rootElementName Name of the root element
   * @param namespaces Optional map of namespace prefixes to URIs
   */
  constructor(service: XmlService, rootElementName: string, namespaces?: Record<string, string>) {
    this.service = service;
    this.rootElementName = rootElementName;
    this.namespaces = namespaces || {};
    this.rootElement = new ElementNode(rootElementName);
    this.currentElement = this.rootElement;
    this.isDisposed = false;

    // Add namespace attributes to root element
    if (namespaces) {
      for (const [prefix, uri] of Object.entries(namespaces)) {
        this.rootElement.setAttribute(prefix === 'xmlns' ? prefix : `xmlns:${prefix}`, uri);
      }
    }
  }

  /**
   * Adds an element to the current context
   *
   * @param name Element name
   * @param content Optional element content
   * @returns This builder instance (for chaining)
   */
  addElement(name: string, content?: string): XmlDocumentBuilder {
    if (this.isDisposed) {
      throw new Error('Cannot use XmlDocumentBuilder after it has been disposed');
    }

    const element = new ElementNode(name);
    if (content !== undefined) {
      element.setContent(content);
    }
    this.currentElement.addChild(element);
    return this;
  }

  /**
   * Adds an attribute to the current element
   *
   * @param name Attribute name
   * @param value Attribute value
   * @returns This builder instance (for chaining)
   */
  addAttribute(name: string, value: string): XmlDocumentBuilder {
    this.currentElement.setAttribute(name, value);
    return this;
  }

  /**
   * Starts a new element and makes it the current element
   *
   * @param name Element name
   * @returns This builder instance (for chaining)
   */
  startElement(name: string): XmlDocumentBuilder {
    const element = new ElementNode(name);
    this.currentElement.addChild(element);
    this.currentElement = element;
    return this;
  }

  /**
   * Sets the content of the current element
   *
   * @param content Text content
   * @returns This builder instance (for chaining)
   */
  setContent(content: string): XmlDocumentBuilder {
    this.currentElement.setContent(content);
    return this;
  }

  /**
   * Ends the current element and moves back to its parent
   *
   * @returns This builder instance (for chaining)
   */
  endElement(): XmlDocumentBuilder {
    if (this.currentElement.parent) {
      this.currentElement = this.currentElement.parent;
    }
    return this;
  }

  /**
   * Adds an empty element (self-closing tag)
   *
   * @param name Element name
   * @returns This builder instance (for chaining)
   */
  addEmptyElement(name: string): XmlDocumentBuilder {
    const element = new ElementNode(name, true);
    this.currentElement.addChild(element);
    return this;
  }

  /**
   * Converts the XML document to string representation
   *
   * @param includeDeclaration Whether to include XML declaration
   * @param version XML version for declaration
   * @param encoding XML encoding for declaration
   * @returns String representation of the XML document
   */
  toString(
    includeDeclaration: boolean = false,
    version: string = '1.0',
    encoding: string = 'UTF-8',
  ): string {
    if (this.isDisposed) {
      throw new Error('Cannot use XmlDocumentBuilder after it has been disposed');
    }

    const xmlContent = this.rootElement.toString(this.service);
    if (includeDeclaration) {
      return this.service.createXmlDocument(xmlContent, version, encoding);
    }
    return xmlContent;
  }

  /**
   * Disposes the document builder by breaking circular references
   * Call this method when you're done with the document builder to prevent memory leaks
   * The builder cannot be used after calling dispose()
   *
   * @returns void
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    // Break circular references by traversing the tree and nullifying parent references
    this.disposeElementNode(this.rootElement);

    // Reset references
    this.rootElement = null as unknown as ElementNode;
    this.currentElement = null as unknown as ElementNode;
    this.isDisposed = true;
  }

  /**
   * Helper method to recursively clean up circular references in element nodes
   *
   * @param node The element node to dispose
   */
  private disposeElementNode(node: ElementNode): void {
    // Clean up children first
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        // Break parent reference
        child.parent = undefined;
        // Recursively dispose child node
        this.disposeElementNode(child);
      }

      // Clear children array
      node.children.length = 0;
    }
  }
}

/**
 * Internal representation of an XML element node
 */
class ElementNode {
  name: string;
  attributes: Record<string, string>;
  content?: string;
  children: ElementNode[];
  parent?: ElementNode;
  isEmpty: boolean;

  constructor(name: string, isEmpty: boolean = false) {
    this.name = name;
    this.attributes = {};
    this.children = [];
    this.isEmpty = isEmpty;
  }

  /**
   * Sets an attribute on this element
   *
   * @param name Attribute name
   * @param value Attribute value
   */
  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  /**
   * Sets the text content of this element
   *
   * @param content Text content
   */
  setContent(content: string): void {
    this.content = content;
  }

  /**
   * Adds a child element to this element
   *
   * @param child Child element
   */
  addChild(child: ElementNode): void {
    child.parent = this;
    this.children.push(child);
  }

  /**
   * Converts this element and its children to string representation
   *
   * @param service XML service for content escaping
   * @returns String representation of this element
   */
  toString(service: XmlService): string {
    // Handle empty elements (self-closing tags)
    if (this.isEmpty) {
      const attributeString = this.getAttributeString(service);
      return `<${this.name}${attributeString} />`;
    }

    // Build opening tag with attributes
    const attributeString = this.getAttributeString(service);
    let result = `<${this.name}${attributeString}>`;

    // Add text content or child elements
    if (this.content !== undefined) {
      result += service.escapeXml(this.content);
    } else if (this.children.length > 0) {
      for (const child of this.children) {
        result += child.toString(service);
      }
    }

    // Add closing tag
    result += `</${this.name}>`;
    return result;
  }

  /**
   * Gets attribute string for element tag
   *
   * @param service XML service for attribute value escaping
   * @returns Formatted attribute string
   */
  private getAttributeString(service: XmlService): string {
    let result = '';
    for (const [name, value] of Object.entries(this.attributes)) {
      result += ` ${name}="${service.escapeXml(value)}"`;
    }
    return result;
  }
}
