import { ShopifyCredentials, Discrepancy, Product, MissingProductGroup, ShopifyVariantNode } from '../types';

const API_VERSION = '2025-07';
const CORS_PROXY_URL = 'https://corsproxy.io/?';
const DEFAULT_LOCATION_ID = 'gid://shopify/Location/86376317245'; // Hardcoded based on user feedback

// --- Helper Functions ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


// --- GraphQL Definitions ---

// For Bulk Operations (Fetching)
const BULK_OPERATION_MUTATION = `
  mutation bulkOperationRunQuery($query: String!) {
    bulkOperationRunQuery(query: $query) {
      bulkOperation {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_CURRENT_BULK_OPERATION_QUERY = `
  query {
    currentBulkOperation {
      id
      status
      errorCode
      url
      objectCount
    }
  }
`;

const PRODUCT_VARIANT_FIELDS_FRAGMENT = `
  id
  sku
  price
  compareAtPrice
  image { id url altText }
  media(first: 1) {
    edges {
      node {
        ... on MediaImage {
          id
          image {
            id
            url
            altText
          }
        }
      }
    }
  }
  selectedOptions {
    name
    value
  }
  product { 
    id
    title 
    handle 
    descriptionHtml
    tags
    media(first: 250) {
      edges {
        node {
          ... on MediaImage {
            id
            image {
              id
              url
              altText
            }
          }
        }
      }
    }
  }
  inventoryItem {
    id
    tracked
    inventoryLevels(first: 10) {
      edges {
        node {
          quantities(names: ["available"]) {
            name
            quantity
          }
          location {
            id
            legacyResourceId
            name
          }
        }
      }
    }
  }
`;

const BULK_PRODUCT_VARIANTS_QUERY = `
{
  productVariants {
    edges {
      node {
        ${PRODUCT_VARIANT_FIELDS_FRAGMENT}
      }
    }
  }
}
`;

// For Batched Fetching by SKU
const BATCHED_PRODUCT_VARIANTS_QUERY = `
  query getProductVariantsBySku($query: String!) {
    productVariants(first: 250, query: $query) {
      edges {
        node {
          ${PRODUCT_VARIANT_FIELDS_FRAGMENT}
        }
      }
    }
  }
`;

// The GraphQL mutation for deleting media (images) from a product
const PRODUCT_MEDIA_DELETE_MUTATION = `
  mutation productDeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
    productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
      deletedMediaIds
      userErrors {
        field
        message
      }
    }
  }
`;


// For Product Publishing (Creating)
const SALES_CHANNEL_PUBLICATION_IDS = [
    "gid://shopify/Publication/172044681533", // Online Store
    "gid://shopify/Publication/172044747069", // Point of Sale
    "gid://shopify/Publication/216846401853", // Facebook & Instagram
    "gid://shopify/Publication/220168356157", // Google & YouTube
    "gid://shopify/Publication/224628212029", // Shop
    "gid://shopify/Publication/255751455037", // Inbox
];

const PRODUCT_PUBLISH_MUTATION = `
  mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_COLLECTION_BY_TITLE_QUERY = `
  query getCollectionByTitle($query: String!) {
    collections(first: 1, query: $query) {
      edges {
        node {
          id
          legacyResourceId
        }
      }
    }
  }
`;

const GET_VARIANTS_BY_SKUS_QUERY = `
  query getVariantsBySkus($query: String!) {
    productVariants(first: 250, query: $query) {
      edges {
        node {
          sku
        }
      }
    }
  }
`;

const GET_PRODUCT_MEDIA_QUERY = `
  query getProductMedia($id: ID!) {
    product(id: $id) {
      media(first: 250) {
        edges {
          node {
            ... on MediaImage {
              id # This is the Media GID
              image {
                originalSrc: url
              }
            }
          }
        }
      }
    }
  }
`;

const VARIANT_MEDIA_APPEND_MUTATION = `
  mutation productVariantAppendMedia($productId: ID!, $variantMedia: [ProductVariantAppendMediaInput!]!) {
    productVariantAppendMedia(productId: $productId, variantMedia: $variantMedia) {
      product { id }
      userErrors { field, message }
    }
  }
`;

// For Product/Variant Updates (Fixing)
const PRODUCT_UPDATE_MUTATION = `
  mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id }
      userErrors { field, message }
    }
  }
`;

const PRODUCT_VARIANT_UPDATE_MUTATION = `
  mutation productVariantUpdate($input: ProductVariantInput!) {
    productVariantUpdate(input: $input) {
      productVariant { id }
      userErrors { field, message }
    }
  }
`;

const GET_PRODUCT_DETAILS_FOR_FIX_QUERY = `
  query getProductDetailsForFix($id: ID!) {
    product(id: $id) {
      bodyHtml
      tags
    }
  }
`;

const PRODUCT_CREATE_MUTATION = `
  mutation productCreate($input: ProductCreateInput!) {
    productCreate(input: $input) {
      product {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const COLLECTION_ADD_PRODUCTS_MUTATION = `
  mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// --- API Helper Functions ---

const buildGraphqlApiUrl = (credentials: ShopifyCredentials) => {
    const baseUrl = `https://${credentials.storeName}.myshopify.com/admin/api/${API_VERSION}/graphql.json`;
    return credentials.useCorsProxy ? `${CORS_PROXY_URL}${baseUrl}` : baseUrl;
};

const buildHeaders = (adminApiAccessToken: string) => {
    return {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminApiAccessToken,
    };
};

const callShopifyGraphqlApi = async (credentials: ShopifyCredentials, query: string, variables?: object) => {
    const response = await fetch(buildGraphqlApiUrl(credentials), {
        method: 'POST',
        headers: buildHeaders(credentials.adminApiAccessToken),
        body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Shopify API call failed. Status: ${response.status}. Body: ${errorBody}`);
    }
    const result = await response.json();
    if (result.errors) {
        throw new Error(`Shopify GraphQL Error: ${JSON.stringify(result.errors)}`);
    }
    return result;
}

const getCollectionIdByTitle = async (credentials: ShopifyCredentials, title: string): Promise<number | null> => {
    const formattedQuery = `title:"${title}"`;
    const { data } = await callShopifyGraphqlApi(credentials, GET_COLLECTION_BY_TITLE_QUERY, { query: formattedQuery });
    const collectionEdge = data.collections?.edges?.[0];
    if (collectionEdge?.node?.legacyResourceId) {
        return Number(collectionEdge.node.legacyResourceId);
    }
    return null;
};

// --- Exported Service Functions ---

export const fetchShopifyProductsBySku = async (
    credentials: ShopifyCredentials,
    skus: string[],
    onProgress: (progress: { fetchedCount: number; totalCount: number | null; message?: string }) => void
): Promise<ShopifyVariantNode[]> => {
    const BATCH_SIZE = 150;
    const allFetchedVariants: ShopifyVariantNode[] = [];
    const totalSkus = skus.length;

    onProgress({ fetchedCount: 0, totalCount: totalSkus, message: `Starting batched fetch for ${totalSkus} SKUs...` });

    for (let i = 0; i < totalSkus; i += BATCH_SIZE) {
        const skuBatch = skus.slice(i, i + BATCH_SIZE);
        const searchQuery = skuBatch.map(sku => `sku:"${sku.replace(/"/g, '\\"')}"`).join(' OR ');

        let success = false;
        let attempt = 0;
        const maxAttempts = 5;

        while (!success && attempt < maxAttempts) {
             try {
                const result = await callShopifyGraphqlApi(credentials, BATCHED_PRODUCT_VARIANTS_QUERY, { query: searchQuery });
                
                if (result.data?.productVariants?.edges) {
                    const variantsFromBatch = result.data.productVariants.edges.map((edge: any) => edge.node);
                    allFetchedVariants.push(...variantsFromBatch);
                }

                const currentProgress = Math.min(i + BATCH_SIZE, totalSkus);
                onProgress({ 
                    fetchedCount: currentProgress,
                    totalCount: totalSkus,
                    message: `Fetched data for ${currentProgress} of ${totalSkus} SKUs. Found ${allFetchedVariants.length} matching variants so far.`
                });
                
                success = true; // Succeeded, exit retry loop.

                // Dynamic Delay Logic based on API cost
                const cost = result.extensions?.cost;
                if (cost) {
                    const { currentlyAvailable, restoreRate } = cost.throttleStatus;
                    const queryCost = cost.actualQueryCost;
                    
                    if (currentlyAvailable < queryCost) {
                        const secondsToWait = (queryCost - currentlyAvailable) / restoreRate;
                        const msToWait = Math.ceil(secondsToWait * 1000) + 250; // Add buffer
                        console.log(`Rate limit approaching. Waiting for ${msToWait}ms.`);
                        await delay(msToWait);
                    } else {
                         await delay(250); // Keep a small base delay
                    }
                } else {
                    await delay(500); // Fallback delay if cost extension is missing
                }

            } catch (error) {
                if (error instanceof Error && error.message.includes('THROTTLED')) {
                    attempt++;
                    const backoffTime = Math.pow(2, attempt) * 500; // Exponential backoff: 1s, 2s, 4s...
                    console.warn(`Throttled! Retrying in ${backoffTime}ms... (Attempt ${attempt}/${maxAttempts})`);
                    onProgress({ 
                        fetchedCount: i,
                        totalCount: totalSkus,
                        message: `Shopify API rate limit reached. Retrying in ${Math.round(backoffTime/1000)}s...`
                    });
                    await delay(backoffTime);
                } else {
                    // It's a different, fatal error
                    console.error(`Failed to fetch batch starting with SKU: ${skuBatch[0]}`, error);
                    throw new Error(`Failed to fetch product data for batch starting with SKU ${skuBatch[0]}. Original error: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        
        if (!success) {
             throw new Error(`Failed to fetch product data for batch starting with SKU ${skuBatch[0]} after ${maxAttempts} attempts due to persistent throttling.`);
        }
    }

    onProgress({ fetchedCount: totalSkus, totalCount: totalSkus, message: `Successfully fetched data for ${allFetchedVariants.length} matching variants.` });
    return allFetchedVariants;
};

export const fetchAllShopifyProducts = async (
    credentials: ShopifyCredentials,
    onProgress: (progress: { fetchedCount: number; totalCount: number | null; message?: string }) => void,
    forceRefresh: boolean
): Promise<ShopifyVariantNode[]> => {

    console.log('🔍 Checking for existing bulk operations...');
    onProgress({ fetchedCount: 0, totalCount: null, message: 'Checking for existing operations...' });
    const { data: initialPollData } = await callShopifyGraphqlApi(credentials, GET_CURRENT_BULK_OPERATION_QUERY);
    let operation = initialPollData.currentBulkOperation;
    console.log(`📊 Current operation status: ${operation?.status || 'No operation found'}`);

    const isEffectivelyComplete = operation && operation.status === 'COMPLETED' && operation.url;
    const hasUsableResults = operation && (operation.status === 'COMPLETED' || operation.status === 'CANCELED') && operation.url;
    const isInProgress = operation && (operation.status === 'RUNNING' || operation.status === 'CREATED' || (operation.status === 'COMPLETED' && !operation.url));

    if (hasUsableResults && !forceRefresh) {
        const totalCount = operation.objectCount ? parseInt(operation.objectCount, 10) : null;
        const statusMessage = operation.status === 'CANCELED' ? 'cached (previously canceled)' : 'recently completed';
        console.log(`✅ Found ${statusMessage} operation with ${totalCount || 'unknown'} products. Downloading results...`);
        onProgress({ fetchedCount: 0, totalCount, message: `Found a ${statusMessage} audit. Downloading results...` });
    } else if (isInProgress) {
        const totalCount = operation.objectCount ? parseInt(operation.objectCount, 10) : null;
        console.log(`🔄 Found in-progress operation. Current status: ${operation.status}, Processed items: ${totalCount || 'unknown'}`);
        onProgress({ fetchedCount: 0, totalCount, message: 'Found an existing audit in progress. Resuming...' });
    } else {
        console.log('🚀 Initiating new bulk operation...');
        onProgress({ fetchedCount: 0, totalCount: null, message: 'Initiating a new product data fetch...' });
        const { data: initiationData } = await callShopifyGraphqlApi(credentials, BULK_OPERATION_MUTATION, { query: BULK_PRODUCT_VARIANTS_QUERY });

        const userErrors = initiationData.bulkOperationRunQuery?.userErrors;
        if (userErrors && userErrors.length > 0) throw new Error(`Error starting bulk operation: ${userErrors.map((e: any) => e.message).join(', ')}`);

        operation = initiationData.bulkOperationRunQuery?.bulkOperation;
        if (!operation || operation.status !== 'CREATED') throw new Error('Failed to create bulk operation.');
    }

    let completedOperation = null;
    let pollCount = 0;
    while (true) {
        pollCount++;
        if (operation && operation.status === 'COMPLETED' && operation.url) {
            console.log(`✅ Bulk operation completed successfully after ${pollCount} polls`);
            completedOperation = operation;
            break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));

        const { data: pollData } = await callShopifyGraphqlApi(credentials, GET_CURRENT_BULK_OPERATION_QUERY);
        operation = pollData.currentBulkOperation;

        if (!operation) throw new Error('The bulk operation disappeared unexpectedly.');
        
        const totalCount = operation.objectCount ? parseInt(operation.objectCount, 10) : null;
        switch (operation.status) {
            case 'COMPLETED':
                if (operation.url) {
                    completedOperation = operation;
                } else {
                    // If the operation is complete but the URL isn't ready, we need to keep polling.
                    onProgress({ fetchedCount: 0, totalCount, message: `Shopify has processed products, waiting for download URL...` });
                    continue; // Continue to the next iteration of the while loop.
                }
                break;
            case 'FAILED': 
                console.error(`❌ Bulk operation failed. Error: ${operation.errorCode}`, operation);
                throw new Error(`Bulk operation failed. Error: ${operation.errorCode}`);
            case 'CANCELED': 
            case 'EXPIRED': 
                console.error(`❌ Bulk operation ${operation.status.toLowerCase()}`);
                throw new Error(`Bulk operation has status: ${operation.status}.`);
            case 'RUNNING': case 'CREATED':
                onProgress({ fetchedCount: 0, totalCount, message: `Shopify is processing ${totalCount || 'many'} products...` });
                continue;
            default: throw new Error(`Unhandled bulk operation status: ${operation.status}`);
        }

        if (completedOperation) break;
    }

    if (!completedOperation || !completedOperation.url) throw new Error('Bulk operation finished, but no result URL was provided.');
    
    const totalCount = completedOperation.objectCount ? parseInt(completedOperation.objectCount, 10) : null;
    onProgress({ fetchedCount: 0, totalCount, message: 'Downloading processed data...' });
    const dataResponse = await fetch(completedOperation.url);
    if (!dataResponse.ok) throw new Error(`Failed to download bulk data. Status: ${dataResponse.status}`);
    const jsonlData = await dataResponse.text();
    const allVariants: ShopifyVariantNode[] = jsonlData.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    console.log(`✅ Successfully processed ${allVariants.length} product variants`);
    onProgress({ fetchedCount: allVariants.length, totalCount: totalCount || allVariants.length, message: `Successfully downloaded ${allVariants.length} product variants.` });
    return allVariants;
};

export const deleteProductImages = async (
    credentials: ShopifyCredentials,
    { productId, mediaIds }: { productId:string; mediaIds: string[] }
): Promise<void> => {
    if (mediaIds.length === 0) return;

    if (!productId || !productId.startsWith('gid://shopify/Product/')) {
        throw new Error(`Invalid or missing product GID for media deletion: ${productId}`);
    }

    const validMediaIds = mediaIds.filter(id => id && id.startsWith('gid://shopify/MediaImage/'));
    
    if (validMediaIds.length !== mediaIds.length) {
        const invalidIds = mediaIds.filter(id => !validMediaIds.includes(id));
        console.warn(`Attempted to delete media with invalid GIDs: ${invalidIds.join(', ')}. These will be ignored.`);
    }

    if (validMediaIds.length === 0) {
        console.log("No valid media IDs to delete.");
        return;
    }

    const result = await callShopifyGraphqlApi(
        credentials,
        PRODUCT_MEDIA_DELETE_MUTATION,
        { productId, mediaIds: validMediaIds }
    );

    const userErrors = result.data?.productDeleteMedia?.userErrors;
    if (userErrors && userErrors.length > 0) {
        const errorMessages = userErrors.map((e: any) => `${e.field ? `[${e.field.join('.')}] ` : ''}${e.message}`).join('; ');
        throw new Error(`GraphQL Error on media delete: ${errorMessages}`);
    }

    // This handles top-level GraphQL transport errors etc.
    if (result.errors) {
        throw new Error(`Shopify GraphQL Error: ${JSON.stringify(result.errors)}`);
    }

    console.log(`Successfully requested deletion for media on product ${productId}:`, result.data?.productDeleteMedia?.deletedMediaIds);
};

export const updateImageAltTexts = async (
    credentials: ShopifyCredentials,
    updates: { imageId: string; altText: string }[]
): Promise<void> => {
    if (updates.length === 0) return;
    // Shopify alt text can contain quotes, which need to be escaped in the GraphQL string.
    const escapeGqlString = (str: string) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const mutationParts = updates.map((update, index) => 
        `update_${index}: productImageUpdate(id: "${update.imageId}", image: { altText: "${escapeGqlString(update.altText)}" }) { image { id, altText }, userErrors { field, message } }`
    ).join('\n');
    
    const mutation = `mutation { ${mutationParts} }`;
    const { data } = await callShopifyGraphqlApi(credentials, mutation);
    
    const allUserErrors = Object.values(data || {}).flatMap((res: any) => res.userErrors || []).filter(Boolean);
    if (allUserErrors.length > 0) {
        const errorMessages = allUserErrors.map((e: any) => `${e.field ? e.field.join('.') : 'Error'}: ${e.message}`).join('; ');
        throw new Error(`Shopify API Error during alt text update: ${errorMessages}`);
    }
};

export const updateVariantImages = async (
    credentials: ShopifyCredentials,
    productId: string,
    updates: { variantId: string; imageId: string | null }[]
): Promise<void> => {
    if (updates.length === 0) return;

    const mutation = `
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants {
                    id
                    image {
                        id
                        url
                    }
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `;

    const variants = updates.map(({ variantId, imageId }) => ({
        id: variantId,
        imageId: imageId, // Can be null to remove the image
    }));

    const variables = {
        productId,
        variants,
    };

    const result = await callShopifyGraphqlApi(credentials, mutation, variables);

    const userErrors = result.data?.productVariantsBulkUpdate?.userErrors;
    if (userErrors && userErrors.length > 0) {
        const errorMessages = userErrors.map((e: any) => e.message).join('; ');
        throw new Error(`Failed to update variant images: ${errorMessages}`);
    }
};


export const fixShopifyProduct = async (credentials: ShopifyCredentials, discrepancy: Discrepancy): Promise<void> => {
    // Product-level fixes
    if (discrepancy.Field === 'H1 in Description' || discrepancy.Field === 'Missing Clearance Tag' || discrepancy.Field === 'Unexpected Clearance Tag') {
        if (!discrepancy.productId) {
            throw new Error(`Cannot fix '${discrepancy.Field}' without a product ID.`);
        }

        // Fetch current product data (description and tags) in a single call
        const { data: productDataResult } = await callShopifyGraphqlApi(credentials, GET_PRODUCT_DETAILS_FOR_FIX_QUERY, { id: discrepancy.productId });
        const product = productDataResult.product;

        if (!product) {
            throw new Error(`Could not fetch product with GID ${discrepancy.productId}.`);
        }

        const productInput: { id: string; bodyHtml?: string; tags?: string[] } = { id: discrepancy.productId };

        if (discrepancy.Field === 'H1 in Description') {
            const currentDescription = product.bodyHtml;
            if (typeof currentDescription !== 'string') {
                // This case should ideally not be hit if the product was fetched successfully.
                throw new Error(`Could not get product description for product ID ${discrepancy.productId}.`);
            }
            const newDescription = currentDescription.replace(/<h1\b/gi, '<h2').replace(/<\/h1>/gi, '</h2>');
            productInput.bodyHtml = newDescription;
        } else { // Tag-related fixes
            let currentTags: string[] = product.tags || [];
            if (discrepancy.Field === 'Missing Clearance Tag') {
                if (!currentTags.find(tag => tag.toLowerCase() === 'clearance')) {
                    currentTags.push('Clearance');
                }
            } else { // Unexpected Clearance Tag
                currentTags = currentTags.filter(tag => tag.toLowerCase() !== 'clearance');
            }
            productInput.tags = currentTags;
        }

        // Execute the update
        const result = await callShopifyGraphqlApi(credentials, PRODUCT_UPDATE_MUTATION, { input: productInput });
        const userErrors = result.data?.productUpdate?.userErrors;
        if (userErrors && userErrors.length > 0) {
            const errorMessages = userErrors.map((e: any) => e.message).join('; ');
            throw new Error(`Failed to update product ${discrepancy.productId}: ${errorMessages}`);
        }
        return;
    }

    // Variant-level fixes
    if (discrepancy.Field === 'Price' || discrepancy.Field === 'Compare Price Issue') {
        if (!discrepancy.variantId) {
            throw new Error(`Cannot fix '${discrepancy.Field}' without a variant ID.`);
        }

        const variantInput: { id: string; price?: string; compareAtPrice?: string | null } = { id: discrepancy.variantId };

        if (discrepancy.Field === 'Price') {
            variantInput.price = discrepancy.FtpValue.toString();
        } else { // Compare Price Issue
            variantInput.compareAtPrice = typeof discrepancy.FtpValue === 'number' && discrepancy.FtpValue > 0
                ? discrepancy.FtpValue.toString()
                : null;
        }

        const result = await callShopifyGraphqlApi(credentials, PRODUCT_VARIANT_UPDATE_MUTATION, { input: variantInput });
        const userErrors = result.data?.productVariantUpdate?.userErrors;
        if (userErrors && userErrors.length > 0) {
            const errorMessages = userErrors.map((e: any) => e.message).join('; ');
            throw new Error(`Failed to update variant ${discrepancy.variantId}: ${errorMessages}`);
        }
        return;
    }

    throw new Error(`Unsupported discrepancy field for fixing: ${discrepancy.Field}`);
};

export const createShopifyProduct = async (credentials: ShopifyCredentials, productGroup: MissingProductGroup, targetLocationGid: string): Promise<void> => {
    // --- Step 0: Pre-flight SKU check (Unchanged) ---
    const skusToCheck = productGroup.variants.map(v => v.SKU);
    if (skusToCheck.length > 0) {
        const searchQuery = skusToCheck.map(sku => `sku:'${sku}'`).join(' OR ');
        const { data: existingVariantsResult } = await callShopifyGraphqlApi(credentials, GET_VARIANTS_BY_SKUS_QUERY, { query: searchQuery });
        const foundSkus = existingVariantsResult.productVariants?.edges.map((edge: any) => edge.node.sku) || [];
        if (foundSkus.length > 0) {
            throw new Error(`Cannot create product. The following SKU(s) already exist in Shopify: ${foundSkus.join(', ')}. Please run a fresh audit to sync data.`);
        }
    }

    // --- Step 1: Prepare GraphQL ProductCreateInput ---
    const getOptionValue = (value: string | undefined, fallback: string) => (value?.trim() || fallback);
    const optionNames = [productGroup.option1Name, productGroup.option2Name, productGroup.option3Name].filter((n): n is string => !!n && n.trim() !== '');

    const tagsToApply: string[] = productGroup.isClearance ? ['Clearance'] : [];

    // Map weight unit to GraphQL enum
    const mapGqlWeightUnit = (unit?: string): 'GRAMS' | 'KILOGRAMS' | 'OUNCES' | 'POUNDS' | undefined => {
        if (!unit) return undefined;
        const lowerUnit = unit.toLowerCase();
        if (lowerUnit.startsWith('g')) return 'GRAMS';
        if (lowerUnit.startsWith('k')) return 'KILOGRAMS';
        if (lowerUnit.startsWith('o')) return 'OUNCES';
        if (lowerUnit.startsWith('p') || lowerUnit.startsWith('lb')) return 'POUNDS';
        return undefined;
    };

    // Prepare variants for GraphQL, including inventory and media association
    const variantsForCreate = productGroup.variants.map(v => {
        const options = [];
        if (productGroup.option1Name) options.push(getOptionValue(v.option1Value, v.SKU));
        if (productGroup.option2Name) options.push(getOptionValue(v.option2Value, '-'));
        if (productGroup.option3Name) options.push(getOptionValue(v.option3Value, '-'));

        const variantInput: any = {
            price: v.Price,
            sku: v.SKU,
            barcode: v.barcode,
            compareAtPrice: v.compareAtPrice,
            options: options.length > 0 ? options : ["Default Title"],
            inventoryPolicy: 'DENY',
            inventoryItem: {
                cost: v.costPerItem,
                tracked: true,
            },
            weight: v.variantGrams ? parseFloat(v.variantGrams.toString()) : undefined,
            weightUnit: v.variantGrams ? mapGqlWeightUnit(v.variantWeightUnit) || 'GRAMS' : undefined,
        };

        // Associate variant with its image by URL during creation
        if (v.ImageUrl) {
            variantInput.mediaSrc = [v.ImageUrl];
        }

        // Set initial inventory quantity for the target location
        if (typeof v.StockQuantity === 'number') {
            variantInput.inventoryQuantities = [{
                availableQuantity: v.StockQuantity,
                locationId: targetLocationGid
            }];
        }

        return variantInput;
    });

    // Prepare media (images) for GraphQL
    const uniqueImages = Array.from(new Map(productGroup.images.map(img => [img.originalSrc, img])).values());
    const mediaForCreate = uniqueImages
        .filter(img => img.originalSrc && !img.originalSrc.includes('via.placeholder.com'))
        .map(img => ({
            originalSource: img.originalSrc,
            alt: img.altText || productGroup.title,
            mediaContentType: 'IMAGE' as const
        }));

    // Assemble the final ProductCreateInput payload
    const productInput = {
        title: productGroup.title,
        bodyHtml: productGroup.description?.replace(/<\/?h1>/gi, match => match.replace('1', '2')),
        vendor: productGroup.vendor,
        productType: productGroup.productType,
        handle: productGroup.handle,
        tags: tagsToApply,
        options: optionNames.length > 0 ? optionNames : ["Title"],
        variants: variantsForCreate,
        media: mediaForCreate,
    };

    // --- Step 2: Create product via GraphQL ---
    const createResult = await callShopifyGraphqlApi(credentials, PRODUCT_CREATE_MUTATION, { input: productInput });

    const userErrors = createResult.data?.productCreate?.userErrors;
    if (userErrors && userErrors.length > 0) {
        const errorMessages = userErrors.map((e: any) => `[${e.field?.join('.')}] ${e.message}`).join('; ');
        throw new Error(`Failed to create product '${productGroup.title}': ${errorMessages}`);
    }

    const productGid = createResult.data?.productCreate?.product?.id;
    if (!productGid) {
        throw new Error(`Failed to create product '${productGroup.title}'. Response was empty or invalid.`);
    }

    // --- Step 3: Run remaining post-creation tasks CONCURRENTLY ---
    // Note: Image linking and inventory are now handled during creation.
    const postCreationTasks: Promise<any>[] = [];

    // Task A: Publishing
    const publicationInputs = SALES_CHANNEL_PUBLICATION_IDS.map(pubId => ({ publicationId: pubId }));
    if (publicationInputs.length > 0) {
        postCreationTasks.push(
            callShopifyGraphqlApi(credentials, PRODUCT_PUBLISH_MUTATION, { id: productGid, input: publicationInputs })
                .catch(e => console.warn(`Failed to publish product ${productGroup.handle}:`, e))
        );
    }

    // Task B: Collection Linking (now using GraphQL)
    if (productGroup.productCategory) {
        postCreationTasks.push(
            getCollectionIdByTitle(credentials, productGroup.productCategory).then(legacyCollectionId => {
                if (legacyCollectionId) {
                    const collectionGid = `gid://shopify/Collection/${legacyCollectionId}`;
                    return callShopifyGraphqlApi(credentials, COLLECTION_ADD_PRODUCTS_MUTATION, { id: collectionGid, productIds: [productGid] });
                }
            }).catch(e => console.warn(`Failed to link collection for ${productGroup.handle}:`, e))
        );
    }

    await Promise.all(postCreationTasks);
};

export const verifyCredentials = async (credentials: ShopifyCredentials): Promise<{ success: boolean; }> => {
    const query = `
      query getShopInfo {
        shop {
          name
        }
      }
    `;
    const { data } = await callShopifyGraphqlApi(credentials, query);
    if (!data.shop?.name) {
        return { success: false };
    }
    return { success: true };
}