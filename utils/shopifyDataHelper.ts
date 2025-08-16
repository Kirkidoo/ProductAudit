



import { Product, ShopifyVariantNode } from '../types';

const TARGET_LOCATION_GID = "gid://shopify/Location/93998154045";
const TARGET_LOCATION_LEGACY_ID = "93998154045";

export const transformShopifyData = (
    rawVariants: ShopifyVariantNode[]
): { products: Product[], rawDataBySku: Map<string, ShopifyVariantNode> } => {
    const products: Product[] = [];
    const rawDataBySku = new Map<string, ShopifyVariantNode>();

    for (const item of rawVariants) {
        // A variant without an associated product or SKU is not useful and can cause errors.
        if (!item || !item.product || !item.sku) {
            continue;
        }
        
        rawDataBySku.set(item.sku, item);

        let stockAtTargetLocation = 0;

        if (item.inventoryItem?.inventoryLevels?.edges) {
            const targetInventoryEdge = item.inventoryItem.inventoryLevels.edges.find(edge => {
                if (!edge?.node?.location) return false;
                const location = edge.node.location;

                // Use multiple checks for robustness
                if (String(location.legacyResourceId) === TARGET_LOCATION_LEGACY_ID) return true;
                if (location.id === TARGET_LOCATION_GID) return true;
                
                return false;
            });

            if (targetInventoryEdge?.node.quantities) {
                const availableQty = targetInventoryEdge.node.quantities.find(q => q.name === "available");
                if (availableQty) {
                    stockAtTargetLocation = availableQty.quantity;
                }
            }
        }
        
        products.push({
            handle: item.product.handle,
            SKU: item.sku,
            ProductName: item.product.title,
            Price: parseFloat(item.price),
            StockQuantity: stockAtTargetLocation,
            ImageUrl: item.image?.url || `https://via.placeholder.com/150/F3F4F6/9CA3AF?text=${item.sku}`,
            variantId: item.id,
            inventoryItemId: item.inventoryItem?.id,
            locationId: TARGET_LOCATION_GID,
            compareAtPrice: item.compareAtPrice ? parseFloat(item.compareAtPrice) : undefined,
        });
    }
    
    return { products, rawDataBySku };
};
