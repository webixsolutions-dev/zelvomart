declare module "sanitize-html" {
  type Attributes = Record<string, string>;
  type Options = {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    allowedSchemes?: string[];
    allowedSchemesByTag?: Record<string, string[]>;
    allowProtocolRelative?: boolean;
    transformTags?: Record<string, (tagName: string, attribs: Attributes) => { tagName: string; attribs: Attributes }>;
  };
  export default function sanitizeHtml(dirty: string, options?: Options): string;
}
