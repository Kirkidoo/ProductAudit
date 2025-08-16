




export interface ShopifyImageNode {
  id: string; // image GID, e.g. gid://shopify/ProductImage/123
  url: string;
  altText: string | null;
  mediaId?: string; // media GID, e.g. gid://shopify/MediaImage/456
}

export interface ProductImage {
  originalSrc: string; // The URL from the CSV
  altText?: string;
  groupId: string; // User-editable group identifier
}

export interface Product {
  handle: string;
  SKU: string;
  ProductName: string;
  Price: number;
  StockQuantity: number; // Represents stock at the target warehouse
  ImageUrl?: string;
  isClearance?: boolean; // To identify products from the clearance file
  // Shopify-specific IDs needed for mutations
  variantId?: string;
  inventoryItemId?: string;
  locationId?: string; // Will hold the target location ID for fixes

  // New fields from user request
  vendor?: string;
  costPerItem?: number;
  compareAtPrice?: number;
  variantGrams?: number;
  variantWeightUnit?: string;
  barcode?: string;
  productType?: string; // Mapped from 'Type'
  productCategory?: string; // Mapped from 'Category'
  description?: string; // Mapped from 'Body (HTML)'
  seoTitle?: string;
  seoDescription?: string;
  tags?: string[];
  
  // Variant options
  option1Name?: string;
  option1Value?: string;
  option2Name?: string;
  option2Value?: string;
  option3Name?: string;
  option3Value?: string;
}


export interface Discrepancy {
  SKU: string;
  ProductName: string;
  Field: 'Price' | 'Duplicate SKU' | 'H1 in Description' | 'Compare Price Issue' | 'Missing Clearance Tag' | 'Unexpected Clearance Tag';
  FtpValue: string | number;
  ShopifyValue: string | number; // For stock, this is the value at the target warehouse
  ImageUrl?: string;
  // IDs needed to execute the fix
  variantId: string;
  productId?: string; // Product GID for product-level fixes like tags
  inventoryItemId?: string;
  locationId?: string;
}

export interface MissingProductGroup {
  handle: string;
  title: string;
  variants: Product[];
  isNewProduct: boolean; // Flag to indicate if the handle is new to Shopify
  isClearance?: boolean; // Flag if the group is from a clearance file
  // Common properties extracted from the first variant
  vendor?: string;
  productType?: string;
  productCategory?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string[];
  option1Name?: string;
  option2Name?: string;
  option3Name?: string;
  // Collect all unique image URLs with grouping info
  images: ProductImage[];
}


export interface AuditResult {
  missingProductGroups: MissingProductGroup[];
  discrepancies: Discrepancy[];
  rawDataBySku?: Map<string, any>;
}

export enum AuditStatus {
  Idle,
  FileUpload,
  InProgress,
  Success,
  Error,
}

export interface ShopifyCredentials {
  storeName: string;
  adminApiAccessToken: string;
  useCorsProxy: boolean;
}

interface InventoryQuantity {
  name: string;
  quantity: number;
}

interface InventoryLevelNode {
  quantities: InventoryQuantity[];
  location: {
    id: string;
    legacyResourceId: string;
    name?: string;
  };
}

// Represents the structure of a variant node from Shopify's paginated GraphQL response
export interface ShopifyVariantNode {
    id: string;
    sku: string;
    price: string;
    compareAtPrice: string | null;
    image: {
      id: string;
      url: string;
      altText: string | null;
    } | null;
    media?: {
        edges: {
            node: {
                id: string; // Media GID
                image: {
                    id: string; // Image GID
                    url: string;
                    altText: string | null;
                }
            }
        }[]
    } | null;
    selectedOptions: {
        name: string;
        value: string;
    }[];
    product: { 
        id: string;
        title: string;
        handle: string;
        descriptionHtml: string;
        tags: string[];
        media: {
            edges: {
                node: {
                    id: string; // This is the Media GID
                    image: {
                        id: string; // This is the Image GID
                        url: string;
                        altText: string | null;
                    }
                };
            }[];
        } | null;
    };
    inventoryItem: {
        id: string;
        tracked: boolean;
        inventoryLevels: {
            edges: {
                node: InventoryLevelNode;
            }[]
        }
    };
}