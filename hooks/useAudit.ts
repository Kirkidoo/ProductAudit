import { useState, useCallback } from 'react';
import { get, set, del } from 'idb-keyval';
import {
  AuditStatus,
  AuditResult,
  Product,
  Discrepancy,
  ShopifyCredentials,
  MissingProductGroup,
  ShopifyVariantNode,
} from '../types';
import {
  fetchAllShopifyProducts,
  fixShopifyProduct,
  createShopifyProduct,
  verifyCredentials,
  updateVariantImages,
  deleteProductImages,
  fetchShopifyProductsBySku,
  updateImageAltTexts,
} from '../services/shopifyService';
import { transformShopifyData } from '../utils/shopifyDataHelper';

const CACHE_KEY = 'shopify_product_data';
const WAREHOUSE_LOCATION_ID = 'gid://shopify/Location/93998154045';

export const useAudit = () => {
  const [auditStatus, setAuditStatus] = useState<AuditStatus>(AuditStatus.Idle);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [progressMessage, setProgressMessage] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [credentials, setCredentials] = useState<ShopifyCredentials | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'missing' | 'issues'>('missing');
  const [isPartialAudit, setIsPartialAudit] = useState<boolean>(false);
  const [sourceFileNames, setSourceFileNames] = useState<string[]>([]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const runAudit = useCallback(async (sourceProducts: Product[], clearanceSkus: Set<string>, forceRefresh: boolean, useBulkOperation: boolean, fileNames: string[]) => {
    if (!credentials) {
      setErrorMessage("Shopify credentials are not configured.");
      setAuditStatus(AuditStatus.Error);
      return;
    }

    setAuditStatus(AuditStatus.InProgress);
    setSourceFileNames(fileNames);
    setErrorMessage('');
    setIsPartialAudit(!useBulkOperation);
    
    try {
      setCurrentStep(0);
      setProgressMessage(`Received ${sourceProducts.length} product entries to audit.`);
      await delay(500);
      
      const sourceProductSkuSet = new Set(sourceProducts.map(p => p.SKU).filter(Boolean));

      if (sourceProducts.length === 0) {
        throw new Error("No valid products found in the uploaded files. Please check the file content and format.");
      }

      setCurrentStep(1);
      const handleBulkProgress = ({
        fetchedCount,
        totalCount,
        message,
      }: {
        fetchedCount: number;
        totalCount: number | null;
        message?: string;
      }) => {
        if (message) {
          if (message.toLowerCase().includes('downloading')) {
              setCurrentStep(2);
          } else if (message.toLowerCase().includes('successfully downloaded')) {
              setCurrentStep(3);
          }
          setProgressMessage(message);
          return;
        }

        if (totalCount !== null) {
          if (fetchedCount === 0) {
            setProgressMessage(
              `Shopify is preparing ${totalCount} products... This may take a moment.`
            );
          } else {
            setProgressMessage(
              `Downloaded ${fetchedCount} of ${totalCount} products from Shopify.`
            );
          }
        } else {
          setProgressMessage('Initiating bulk product fetch from Shopify...');
        }
      };

      let rawShopifyVariants: ShopifyVariantNode[];
      const cachedData = await get<ShopifyVariantNode[]>(CACHE_KEY);
      const useCache = !forceRefresh && Array.isArray(cachedData) && useBulkOperation;
      
      if (useCache) {
          setProgressMessage('Using cached Shopify data for faster results.');
          rawShopifyVariants = cachedData;
          await delay(1000);
          setCurrentStep(3);
      } else {
          if (useBulkOperation) {
              rawShopifyVariants = await fetchAllShopifyProducts(credentials, handleBulkProgress, forceRefresh);
              await set(CACHE_KEY, rawShopifyVariants);
          } else {
              const skusToFetch = [...new Set(sourceProducts.map(p => p.SKU).filter(Boolean))];
              const handleBatchProgress = ({ fetchedCount, totalCount, message }: { fetchedCount: number; totalCount: number | null; message?: string }) => {
                  setCurrentStep(2);
                  setProgressMessage(message || `Fetching products... ${fetchedCount}/${totalCount}`);
              };
              rawShopifyVariants = await fetchShopifyProductsBySku(credentials, skusToFetch, handleBatchProgress);
          }
          await delay(500);
      }
      
      setCurrentStep(3);
      setProgressMessage('Transforming Shopify data for analysis...');
      const { products: shopifyProducts, rawDataBySku } = transformShopifyData(rawShopifyVariants);
      await delay(200);

      setProgressMessage('Comparing source products against Shopify data...');
      const shopifyProductMap = new Map<string, Product>(
        shopifyProducts.map(p => [p.SKU, p])
      );
      const shopifyHandles = new Set(shopifyProducts.map(p => p.handle));

      const missingVariants: Product[] = [];
      const discrepancies: Discrepancy[] = [];

      for (const sourceProduct of sourceProducts) {
        if (!sourceProduct.SKU) continue;
        const shopifyProduct = shopifyProductMap.get(sourceProduct.SKU);

        if (!shopifyProduct) {
          missingVariants.push(sourceProduct);
        } else {
          if (!shopifyProduct.variantId) continue;
          
          if (Math.abs(sourceProduct.Price - shopifyProduct.Price) > 0.001) {
            discrepancies.push({
              SKU: sourceProduct.SKU,
              ProductName: shopifyProduct.ProductName,
              Field: 'Price',
              FtpValue: sourceProduct.Price,
              ShopifyValue: shopifyProduct.Price,
              ImageUrl: shopifyProduct.ImageUrl || sourceProduct.ImageUrl,
              variantId: shopifyProduct.variantId,
            });
          }

          if (sourceProduct.isClearance) {
              const ftpComparePrice = sourceProduct.compareAtPrice ?? null;
              const shopifyComparePrice = shopifyProduct.compareAtPrice ?? null;
    
              const normalizedFtp = ftpComparePrice === 0 ? null : ftpComparePrice;
              const normalizedShopify = shopifyComparePrice === 0 ? null : shopifyComparePrice;
    
              let hasDiscrepancy = false;
              if (normalizedFtp === null && normalizedShopify === null) {
              } else if (normalizedFtp !== null && normalizedShopify !== null) {
                  if (Math.abs(normalizedFtp - normalizedShopify) >= 0.001) {
                      hasDiscrepancy = true;
                  }
              } else {
                  hasDiscrepancy = true;
              }
    
              if (hasDiscrepancy) {
                  discrepancies.push({
                      SKU: sourceProduct.SKU, ProductName: shopifyProduct.ProductName, Field: 'Compare Price Issue',
                      FtpValue: ftpComparePrice ?? 'Not Provided', ShopifyValue: shopifyComparePrice ?? 'Not Set',
                      ImageUrl: shopifyProduct.ImageUrl || sourceProduct.ImageUrl, variantId: shopifyProduct.variantId,
                  });
              }
          }
        }
      }
      
      setProgressMessage('Running data integrity checks (duplicates, etc)...');
      await delay(200);

      const skuCounts = new Map<string, ShopifyVariantNode[]>();
      for (const variant of rawShopifyVariants) {
          if (variant?.sku) {
              if (!skuCounts.has(variant.sku)) {
                  skuCounts.set(variant.sku, []);
              }
              skuCounts.get(variant.sku)!.push(variant);
          }
      }

      for (const [sku, variants] of skuCounts.entries()) {
          if (variants.length > 1 && sourceProductSkuSet.has(sku)) {
              const primaryVariant = variants.find(v => v.product) || variants[0];
              const productNames = variants
                  .map(v => v.product?.title)
                  .filter((title): title is string => !!title)
                  .join(' & ');
              discrepancies.push({
                  SKU: sku,
                  ProductName: productNames || 'Orphaned or Missing Product Info',
                  Field: 'Duplicate SKU',
                  FtpValue: 'Expected 1',
                  ShopifyValue: `Found ${variants.length} times`,
                  ImageUrl: primaryVariant.image?.url,
                  variantId: primaryVariant.id,
              });
          }
      }

      const processedHandlesForH1 = new Set<string>();
        for (const variant of rawShopifyVariants) {
            if (!variant?.product?.id || !variant.sku || !sourceProductSkuSet.has(variant.sku)) continue;
            if (processedHandlesForH1.has(variant.product.handle)) continue;

            if (variant.product.descriptionHtml && /<h1/i.test(variant.product.descriptionHtml)) {
                discrepancies.push({
                    SKU: variant.sku,
                    ProductName: variant.product.title,
                    Field: 'H1 in Description',
                    FtpValue: 'Not allowed',
                    ShopifyValue: 'Contains <h1> tag',
                    ImageUrl: variant.image?.url,
                    variantId: variant.id,
                    productId: variant.product.id,
                });
                processedHandlesForH1.add(variant.product.handle);
            }
        }

      const processedHandlesForClearance = new Set<string>();
      for (const variant of rawShopifyVariants) {
          if (!variant?.product?.id || !variant.sku) continue;
          if (processedHandlesForClearance.has(variant.product.handle)) continue;

          if (clearanceSkus.has(variant.sku)) {
              const tags = variant.product.tags;
              const hasClearanceTag = Array.isArray(tags) && tags.some(tag => typeof tag === 'string' && tag.trim().toLowerCase() === 'clearance');

              if (!hasClearanceTag) {
                  const shopifyTagsDisplay = Array.isArray(tags) ? tags.join(', ') : (tags ? String(tags) : '');

                  discrepancies.push({
                      SKU: variant.sku,
                      ProductName: variant.product.title,
                      Field: 'Missing Clearance Tag',
                      FtpValue: 'Required',
                      ShopifyValue: shopifyTagsDisplay || 'None',
                      ImageUrl: variant.image?.url,
                      variantId: variant.id,
                      productId: variant.product.id,
                  });
                  processedHandlesForClearance.add(variant.product.handle);
              }
          }
      }
      
      if (useBulkOperation) {
          const processedHandlesForUnexpectedTag = new Set<string>();
          for (const variant of rawShopifyVariants) {
              if (!variant?.product?.id || !variant.sku || !sourceProductSkuSet.has(variant.sku)) continue;
              if (processedHandlesForUnexpectedTag.has(variant.product.handle)) continue;

              const tags = variant.product.tags;
              const hasClearanceTag = Array.isArray(tags) && tags.some(tag => typeof tag === 'string' && tag.trim().toLowerCase() === 'clearance');

              if (hasClearanceTag && !clearanceSkus.has(variant.sku)) {
                  const shopifyTagsDisplay = Array.isArray(tags) ? tags.join(', ') : (tags ? String(tags) : '');

                  discrepancies.push({
                      SKU: variant.sku,
                      ProductName: variant.product.title,
                      Field: 'Unexpected Clearance Tag',
                      FtpValue: 'Not in clearance file',
                      ShopifyValue: shopifyTagsDisplay,
                      ImageUrl: variant.image?.url,
                      variantId: variant.id,
                      productId: variant.product.id,
                  });
                  processedHandlesForUnexpectedTag.add(variant.product.handle);
              }
          }
      }

      setCurrentStep(4);
      setProgressMessage('Grouping missing variants into products...');
      await delay(200);

      const missingGroupsMap = new Map<string, Product[]>();
      for(const variant of missingVariants) {
          if (!missingGroupsMap.has(variant.handle)) {
              missingGroupsMap.set(variant.handle, []);
          }
          missingGroupsMap.get(variant.handle)!.push(variant);
      }

      const missingProductGroups: MissingProductGroup[] = Array.from(missingGroupsMap.entries()).map(([handle, variants]) => {
          const firstVariant = variants[0];
          const allImages = variants.map(v => v.ImageUrl).filter(Boolean);
          const uniqueImages = [...new Set(allImages)];
          const isNewProduct = !shopifyHandles.has(handle);
          const productTypeFromTags = firstVariant.tags?.[2];

          return {
              handle,
              title: firstVariant.ProductName,
              variants,
              isNewProduct,
              isClearance: variants.some(v => v.isClearance),
              vendor: firstVariant.vendor,
              productType: productTypeFromTags,
              productCategory: firstVariant.productCategory,
              description: firstVariant.description,
              seoTitle: firstVariant.seoTitle,
              seoDescription: firstVariant.seoDescription,
              images: uniqueImages.map((src, index) => ({
                originalSrc: src!,
                altText: firstVariant.ProductName,
                groupId: `${index}`
              })),
              option1Name: firstVariant.option1Name,
              option2Name: firstVariant.option2Name,
              option3Name: firstVariant.option3Name,
          };
      });

      setProgressMessage('Finalizing audit report...');
      await delay(500);

      const finalResult = { missingProductGroups, discrepancies, rawDataBySku };
      const initialTab = finalResult.missingProductGroups.length > 0 || finalResult.discrepancies.length === 0 ? 'missing' : 'issues';
      
      setActiveTab(initialTab);
      setAuditResult(finalResult);
      setAuditStatus(AuditStatus.Success);

    } catch (error) {
      console.error("Audit failed:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred during the audit.";
      setErrorMessage(`The audit could not be completed. ${message}`);
      setAuditStatus(AuditStatus.Error);
    }
  }, [credentials]);

  const handleConfigSubmit = async (shopifyCreds: ShopifyCredentials) => {
    setIsConfigLoading(true);
    setErrorMessage('');
    try {
      const { success } = await verifyCredentials(shopifyCreds);
      if (!success) {
          throw new Error("Verification failed. Please check store domain and token.");
      }

      setLocationId(WAREHOUSE_LOCATION_ID);
      setCredentials(shopifyCreds);
      setAuditStatus(AuditStatus.FileUpload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setErrorMessage(`Could not connect to Shopify. ${message}`);
      setAuditStatus(AuditStatus.Error);
    } finally {
      setIsConfigLoading(false);
    }
  };

  const handleNewAudit = async () => {
    await del(CACHE_KEY);
    setAuditStatus(AuditStatus.Idle);
    setAuditResult(null);
    setErrorMessage('');
    setCredentials(null);
    setLocationId(null);
    setCurrentStep(0);
    setProgressMessage('');
    setSourceFileNames([]);
    setIsPartialAudit(false);
  };

  const handleCreateProductGroup = async (groupToCreate: MissingProductGroup) => {
    if (!credentials || !locationId) return;
    await createShopifyProduct(credentials, groupToCreate, locationId);
    handleRemoveItemFromReport(groupToCreate.handle, 'missing');
  };

  const handleFixProduct = async (discrepancyToFix: Discrepancy) => {
    if (!credentials || !locationId) return;
    await fixShopifyProduct(credentials, discrepancyToFix);
    handleRemoveItemFromReport(`${discrepancyToFix.SKU}-${discrepancyToFix.Field}`, 'issues');
  };

  const handleUpdateVariantImages = async (productId: string, updates: { variantId: string; imageId: string | null }[]) => {
    if (!credentials) return;
    await updateVariantImages(credentials, productId, updates);
  };

  const handleUpdateImageAltTexts = async (updates: { imageId: string; altText: string }[]) => {
    if (!credentials) return;
    await updateImageAltTexts(credentials, updates);
  };

  const handleDeleteProductImages = async (data: { productId: string; mediaIds: string[] }) => {
    if (!credentials) return;
    await deleteProductImages(credentials, data);
  };

  const handleRemoveItemFromReport = (keyToRemove: string, type: 'missing' | 'issues') => {
    setAuditResult(prevResult => {
      if (!prevResult) return null;

      if (type === 'missing') {
        return {
          ...prevResult,
          missingProductGroups: prevResult.missingProductGroups.filter(g => g.handle !== keyToRemove),
        };
      } else { // type === 'issues'
        return {
          ...prevResult,
          discrepancies: prevResult.discrepancies.filter(d => `${d.SKU}-${d.Field}` !== keyToRemove),
        };
      }
    });
  };

  const handleBulkRemoveItemsFromReport = (keysToRemove: string[], type: 'missing' | 'issues') => {
    setAuditResult(prevResult => {
      if (!prevResult) return null;
      const keysSet = new Set(keysToRemove);

      if (type === 'missing') {
        return {
          ...prevResult,
          missingProductGroups: prevResult.missingProductGroups.filter(g => !keysSet.has(g.handle)),
        };
      } else { // type === 'issues'
        return {
          ...prevResult,
          discrepancies: prevResult.discrepancies.filter(d => !keysSet.has(`${d.SKU}-${d.Field}`)),
        };
      }
    });
  };

  return {
    auditStatus,
    auditResult,
    errorMessage,
    progressMessage,
    currentStep,
    isConfigLoading,
    activeTab,
    isPartialAudit,
    sourceFileNames,
    runAudit,
    handleConfigSubmit,
    handleNewAudit,
    handleCreateProductGroup,
    handleFixProduct,
    handleUpdateVariantImages,
    handleUpdateImageAltTexts,
    handleDeleteProductImages,
    handleRemoveItemFromReport,
    handleBulkRemoveItemsFromReport,
    setActiveTab,
  };
};