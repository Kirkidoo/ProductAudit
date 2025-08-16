



import React, { useState, useMemo, useEffect, useRef, memo, useCallback } from 'react';
import { del } from 'idb-keyval';
import { AuditResult, Product, Discrepancy, MissingProductGroup, ShopifyVariantNode, ShopifyImageNode } from '../types';
import { CreateIcon, FixIcon, SpinnerIcon, DownloadIcon, ArchiveBoxIcon, AlertTriangleIcon, EyeIcon, ChevronDownIcon, DebugIcon, CheckCircleSolidIcon, FileTextIcon } from './icons';
import DraftProductPage from './DraftProductPage';
import DebugModal from './DebugModal';
import IssueFilterDropdown from './IssueFilterDropdown';
import MissingFilterDropdown, { MissingFilterType } from './MissingFilterDropdown';
import ExistingImageManager from './ExistingImageManager';
import Pagination from './Pagination';

const CACHE_KEY = 'shopify_product_data';
const ITEMS_PER_PAGE = 20;

interface ReportScreenProps {
  result: AuditResult;
  onNewAudit: () => void;
  onCreateProductGroup: (productGroup: MissingProductGroup) => Promise<void>;
  onFixProduct: (discrepancy: Discrepancy) => Promise<void>;
  onExportCsv: () => void;
  onRemoveItem: (key: string, type: 'missing' | 'issues') => void;
  onBulkRemoveItems: (keys: string[], type: 'missing' | 'issues') => void;
  allIssueTypes: Discrepancy['Field'][];
  onUpdateVariantImages: (productId: string, updates: {variantId: string, imageId: string | null}[]) => Promise<void>;
  onUpdateImageAltTexts: (updates: {imageId: string, altText: string}[]) => Promise<void>;
  onDeleteProductImages: (data: {productId: string, mediaIds: string[]}) => Promise<void>;
  activeTab: 'missing' | 'issues';
  setActiveTab: (tab: 'missing' | 'issues') => void;
  isPartialAudit: boolean;
  sourceFileNames: string[];
}

type UpdateStatus = {
    loading: boolean;
    success?: boolean;
    error?: string;
}

interface IssuesByProduct {
  productInfo: {
    productId: string;
    handle: string;
    title: string;
    imageUrl?: string;
    allImages: ShopifyImageNode[];
  };
  variants: ShopifyVariantNode[];
  issues: Discrepancy[];
}

// Helper function moved outside the component for stability
const isIssueFixable = (field: Discrepancy['Field']) => {
    return ['Price', 'Compare Price Issue', 'H1 in Description', 'Missing Clearance Tag', 'Unexpected Clearance Tag'].includes(field);
};

// Helper rendering functions can also be outside the component
const getRowClass = (status: UpdateStatus | undefined, isSelected: boolean) => {
    if (status?.success) return 'bg-green-100 transition-colors duration-300';
    if (status?.error) return 'bg-rose-50';
    if (isSelected) return 'bg-indigo-50';
    return 'bg-white';
};

const FieldBadge: React.FC<{ field: Discrepancy['Field'] }> = ({ field }) => {
    const styles: { [key in Discrepancy['Field']]: string } = {
      'Price': 'bg-amber-100 text-amber-800', 'Duplicate SKU': 'bg-rose-100 text-rose-800', 'H1 in Description': 'bg-purple-100 text-purple-800',
      'Compare Price Issue': 'bg-orange-100 text-orange-800', 'Missing Clearance Tag': 'bg-sky-100 text-sky-800', 'Unexpected Clearance Tag': 'bg-yellow-100 text-yellow-800',
    };
    const text: { [key in Discrepancy['Field']]: string } = {
        'Price': 'Price', 'Duplicate SKU': 'Duplicate SKU', 'H1 in Description': 'H1 in Desc', 'Compare Price Issue': 'Compare Price',
        'Missing Clearance Tag': 'Clearance Tag', 'Unexpected Clearance Tag': 'Unexpected Clearance',
    };
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[field]}`}>{text[field]}</span>
};

const renderValue = (item: Discrepancy, valueType: 'ftp' | 'shopify') => {
    const value = valueType === 'ftp' ? item.FtpValue : item.ShopifyValue;
    switch (item.Field) {
      case 'Price': case 'Compare Price Issue':
        if (typeof value === 'number') return `$${value.toFixed(2)}`;
        return <span className="text-slate-500 italic">{String(value)}</span>;
      case 'Missing Clearance Tag':
        if (valueType === 'ftp') return <span className="font-semibold text-green-700">{value}</span>;
        return <span className="text-rose-700 italic text-xs truncate max-w-xs" title={value.toString()}>{value.toString() || 'None'}</span>;
      case 'Unexpected Clearance Tag':
        if (valueType === 'shopify') return <span className="text-rose-700 font-semibold" title={value.toString()}>{value.toString() || 'None'}</span>;
        return <span className="text-slate-500 italic">{value}</span>;
      default:
        return <span className={valueType === 'ftp' ? 'text-slate-500 italic' : ''}>{value}</span>;
    }
};

// Row components moved outside of ReportScreen to prevent re-creation on every render
// This allows React.memo to work effectively.
const MissingRow = memo(({ 
    group, isExpanded, status, isSelected, isBulkUpdating, 
    onToggleExpansion, onToggleSelection, onPreview, onCreate 
}: {
    group: MissingProductGroup;
    isExpanded: boolean;
    status?: UpdateStatus;
    isSelected: boolean;
    isBulkUpdating: boolean;
    onToggleExpansion: (handle: string) => void;
    onToggleSelection: (key: string, type: 'missing' | 'issues') => void;
    onPreview: (group: MissingProductGroup) => void;
    onCreate: (group: MissingProductGroup) => void;
}) => {
    if (!group) return null;

    const key = group.handle;
    const isUpdating = status?.loading;
    const isSuccess = status?.success;

    return (
        <div className={`border-b border-slate-200 ${getRowClass(status, isSelected)}`}>
          <div className="flex items-center px-4 py-4 w-full">
            <div className="w-12 flex-shrink-0"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={isSelected} onChange={() => onToggleSelection(key, 'missing')} disabled={isUpdating || isSuccess}/></div>
            <div className="w-12 flex-shrink-0">
                <button onClick={() => onToggleExpansion(key)} className="p-2 rounded-full hover:bg-slate-200">
                    <ChevronDownIcon className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
            </div>
            <div className="flex-1 px-2">
                <div className="flex items-center">
                    <img src={group.images[0]?.originalSrc} alt={group.title} className="h-14 w-14 rounded-md object-cover flex-shrink-0"/>
                    <div className="ml-4">
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-slate-900 max-w-xs truncate" title={group.title}>{group.title}</div>
                            {group.isNewProduct ? ( <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">New Product</span>) 
                            : ( <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">New Variants</span> )}
                            {group.isClearance && ( <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">Clearance</span> )}
                        </div>
                        <div className="text-sm text-slate-500">Handle: {group.handle}</div>
                    </div>
                </div>
            </div>
            <div className="w-48 px-2 text-sm text-slate-600"><span className="font-semibold">{group.variants.length}</span> missing variant(s)</div>
            <div className="w-64 px-2 text-sm">
                <div className="flex items-center space-x-2">
                    <button onClick={() => onPreview(group)} disabled={isBulkUpdating || isUpdating || isSuccess} className="inline-flex items-center px-3 py-1.5 border border-slate-300 text-xs font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:bg-slate-200 disabled:cursor-not-allowed">
                      <EyeIcon /> Preview
                    </button>
                    <button onClick={() => onCreate(group)} disabled={isUpdating || isBulkUpdating || isSuccess} className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${status?.error ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500' : isSuccess ? 'bg-green-600 focus:ring-green-500' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'} disabled:bg-slate-400 disabled:cursor-wait`}>
                      {isUpdating ? <SpinnerIcon/> : isSuccess ? <CheckCircleSolidIcon /> : <CreateIcon/>}
                      {isUpdating ? 'Creating...' : isSuccess ? 'Created' : (status?.error ? 'Retry' : 'Create')}
                    </button>
                    {status?.error && <p className="mt-1 text-xs text-rose-600 max-w-[150px]">{status.error}</p>}
                </div>
            </div>
          </div>
          {isExpanded && (
              <div className="p-4 bg-slate-50">
                <h4 className="text-sm font-semibold text-slate-700 mb-2 pl-2">Missing Variants</h4>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SKU</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Price</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Stock</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Weight</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Barcode</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {group.variants.map((variant: Product) => (
                                <tr key={variant.SKU}>
                                    <td className="px-4 py-3 text-sm text-slate-800 font-medium">{variant.SKU}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">${variant.Price.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{variant.StockQuantity}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{variant.variantGrams ? `${variant.variantGrams} ${variant.variantWeightUnit || 'g'}` : 'N/A'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{variant.barcode || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
          )}
        </div>
    )
});

const IssuesRow = memo(({
    productGroup, isExpanded, updatingItems, selectedIssues, isBulkUpdating,
    onToggleExpansion, onToggleProductSelection, onToggleIndividualSelection, onManageImages, onFix
} : {
    productGroup: IssuesByProduct;
    isExpanded: boolean;
    updatingItems: Record<string, UpdateStatus>;
    selectedIssues: Set<string>;
    isBulkUpdating: boolean;
    onToggleExpansion: (handle: string) => void;
    onToggleProductSelection: (productGroup: IssuesByProduct) => void;
    onToggleIndividualSelection: (key: string, type: 'missing' | 'issues') => void;
    onManageImages: (productGroup: IssuesByProduct) => void;
    onFix: (discrepancy: Discrepancy) => void;
}) => {
    if (!productGroup) return null;

    const { productInfo, issues, variants } = productGroup;
    const key = productInfo.handle;
    const status = updatingItems[key];
    const uniqueIssueFields = [...new Set(issues.map((issue) => issue.Field))];

    const fixableIssuesInGroup = issues.filter((issue) => isIssueFixable(issue.Field));
    const fixableIssueKeysInGroup = fixableIssuesInGroup.map((issue) => `${issue.SKU}-${issue.Field}`);
    const selectedInGroupCount = fixableIssueKeysInGroup.filter((key) => selectedIssues.has(key)).length;
    const isProductSelected = selectedInGroupCount === fixableIssueKeysInGroup.length && fixableIssueKeysInGroup.length > 0;
    const isProductIndeterminate = selectedInGroupCount > 0 && selectedInGroupCount < fixableIssueKeysInGroup.length;
    
    return (
        <div className={`border-b border-slate-200 ${getRowClass(status, isProductSelected)}`}>
            <div className="flex items-start px-4 py-4 w-full">
                <div className="w-12 pt-1 flex-shrink-0">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                        checked={isProductSelected} ref={input => { if (input) input.indeterminate = isProductIndeterminate }}
                        onChange={() => onToggleProductSelection(productGroup)} disabled={fixableIssueKeysInGroup.length === 0 || isBulkUpdating}
                    />
                </div>
                <div className="w-12 pt-1 flex-shrink-0">
                    <button onClick={() => onToggleExpansion(key)} className="p-2 rounded-full hover:bg-slate-200">
                        <ChevronDownIcon className={`h-5 w-5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                <div className="flex-1 px-2">
                    <div className="flex items-start">
                        <img src={productInfo.imageUrl || "https://via.placeholder.com/150/F3F4F6/9CA3AF?text=N/A"} alt={productInfo.title} className="h-14 w-14 rounded-md object-cover flex-shrink-0"/>
                        <div className="ml-4">
                            <div className="text-sm font-medium text-slate-900 max-w-sm truncate" title={productInfo.title}>{productInfo.title}</div>
                            <div className="text-sm text-slate-500">Handle: {productInfo.handle}</div>
                            <div className="text-sm text-slate-500">{variants.length} variant(s)</div>
                        </div>
                    </div>
                </div>
                <div className="w-72 px-2">
                    <div className="flex flex-wrap gap-2 max-w-md">{uniqueIssueFields.map(field => <FieldBadge key={field} field={field} />)}</div>
                </div>
                <div className="w-56 px-2 text-sm">
                    <button onClick={() => onManageImages(productGroup)} disabled={isBulkUpdating || status?.loading || status?.success}
                    className="inline-flex items-center px-3 py-1.5 border border-slate-300 text-xs font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:bg-slate-200 disabled:cursor-not-allowed">
                        <EyeIcon /> Manage Images
                        <span className="ml-1.5 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {productInfo.allImages.length}
                        </span>
                    </button>
                </div>
            </div>
            {isExpanded && (
                <div className="p-4 bg-slate-50/70">
                    <div className="bg-white rounded-md overflow-hidden shadow-inner">
                        <table className="min-w-full">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="w-12 px-4 py-2"></th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SKU & Issue</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Details</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {issues.map((item: Discrepancy) => {
                                    const issueKey = `${item.SKU}-${item.Field}`;
                                    const issueStatus = updatingItems[issueKey];
                                    const isIssueUpdating = issueStatus?.loading;
                                    const isIssueSuccess = issueStatus?.success;
                                    const isIssueSelected = selectedIssues.has(issueKey);
                                    const fixable = isIssueFixable(item.Field);
                                    return (
                                        <tr key={issueKey} className={getRowClass(issueStatus, isIssueSelected)}>
                                            <td className="px-4 py-3"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed" checked={isIssueSelected} onChange={() => onToggleIndividualSelection(issueKey, 'issues')} disabled={!fixable || isIssueUpdating || isIssueSuccess}/></td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-slate-800"><FieldBadge field={item.Field} /></div>
                                                <p className="text-xs text-slate-600 mt-1">SKU: {item.SKU}</p>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <p>Expected: <span className="font-semibold">{renderValue(item, 'ftp')}</span></p>
                                                <p>Shopify: <span className="font-semibold">{renderValue(item, 'shopify')}</span></p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button onClick={() => onFix(item)} disabled={!fixable || isIssueUpdating || isBulkUpdating || isIssueSuccess} className={`inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${issueStatus?.error ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500' : isIssueSuccess ? 'bg-green-600 focus:ring-green-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'} disabled:bg-slate-400 disabled:cursor-wait`}>
                                                    {isIssueUpdating ? <SpinnerIcon/> : isIssueSuccess ? <CheckCircleSolidIcon /> : <FixIcon/>}
                                                    {isIssueUpdating ? 'Fixing...' : isIssueSuccess ? 'Fixed' : (issueStatus?.error ? 'Retry' : 'Fix It')}
                                                </button>
                                                {issueStatus?.error && <p className="mt-1 text-xs text-rose-600 max-w-[150px]">{issueStatus.error}</p>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
});

const BulkProgressIndicator: React.FC<{
    current: number;
    total: number;
    message: string;
    action: 'Creating' | 'Fixing';
}> = ({ current, total, message, action }) => {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    
    return (
        <div className="w-full px-2">
            <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">{action}... ({current} / {total})</span>
                <span className="text-sm font-medium text-slate-700">{Math.round(percentage)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-700">
                <div 
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-linear" 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
             {message && <p className="text-xs text-slate-500 mt-2 text-center truncate" title={message}>Current: {message}</p>}
        </div>
    );
};


const ReportScreen: React.FC<ReportScreenProps> = ({ result, onNewAudit, onCreateProductGroup, onFixProduct, onExportCsv, onRemoveItem, onBulkRemoveItems, allIssueTypes, onUpdateVariantImages, onUpdateImageAltTexts, onDeleteProductImages, activeTab, setActiveTab, isPartialAudit, sourceFileNames }) => {
  const { missingProductGroups, discrepancies, rawDataBySku } = result;
  
  // State
  const [updatingItems, setUpdatingItems] = useState<Record<string, UpdateStatus>>({});
  const [expandedRows, setExpandedRows] = useState(new Set<string>());
  const [selectedMissing, setSelectedMissing] = useState(new Set<string>());
  const [selectedIssues, setSelectedIssues] = useState(new Set<string>());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [viewingProductGroup, setViewingProductGroup] = useState<MissingProductGroup | null>(null);
  const [managingImagesForProduct, setManagingImagesForProduct] = useState<IssuesByProduct | null>(null);
  const [debuggingItem, setDebuggingItem] = useState<any | null>(null);
  const [issueFilters, setIssueFilters] = useState<Set<Discrepancy['Field']>>(new Set(allIssueTypes));
  const [missingProductFilter, setMissingProductFilter] = useState<MissingFilterType>('all');
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, message: '', action: '' as 'Creating' | 'Fixing' | '' });
  const [currentPageMissing, setCurrentPageMissing] = useState(1);
  const [currentPageIssues, setCurrentPageIssues] = useState(1);

  // Refs
  const timeoutIds = useRef(new Set<number>());

  // Cleanup timeouts on unmount
  useEffect(() => {
    const ids = timeoutIds.current;
    return () => {
      ids.forEach(clearTimeout);
    };
  }, []);

  // Filtered and Grouped Data
  const handleIssueFilterChange = (newFilters: Set<Discrepancy['Field']>) => {
      setIssueFilters(newFilters);
      setCurrentPageIssues(1);
  };
  
  const handleMissingFilterChange = (newFilter: MissingFilterType) => {
    setMissingProductFilter(newFilter);
    setCurrentPageMissing(1);
  };
  
  const filteredMissingProductGroups = useMemo(() => {
    if (missingProductFilter === 'all') {
      return missingProductGroups;
    }
    return missingProductGroups.filter(group => 
      missingProductFilter === 'new_product' ? group.isNewProduct : !group.isNewProduct
    );
  }, [missingProductGroups, missingProductFilter]);

  const filteredMissingProductHandles = useMemo(() => filteredMissingProductGroups.map(p => p.handle), [filteredMissingProductGroups]);

  // EFFICIENT data transformation for issues
  const issuesByProduct = useMemo((): IssuesByProduct[] => {
    if (!rawDataBySku || !discrepancies) return [];

    // 1. Group discrepancies by product handle for fast lookup
    const discrepanciesByHandle = new Map<string, Discrepancy[]>();
    for (const discrepancy of discrepancies) {
        const variantData = rawDataBySku.get(discrepancy.SKU);
        const handle = variantData?.product?.handle;
        if (handle) {
            if (!discrepanciesByHandle.has(handle)) {
                discrepanciesByHandle.set(handle, []);
            }
            discrepanciesByHandle.get(handle)!.push(discrepancy);
        }
    }
    
    // 2. Iterate through all variants once to build product groups
    const productsMap = new Map<string, IssuesByProduct>();
    for (const variant of rawDataBySku.values()) {
        if (!variant?.product?.handle || !variant?.product?.id) continue;
        const handle = variant.product.handle;

        if (!productsMap.has(handle)) {
            const productIssues = discrepanciesByHandle.get(handle) || [];
            if (productIssues.length === 0) continue; // Skip products with no issues

            // Aggregate all unique images from the product.
            const imageMap = new Map<string, ShopifyImageNode>();
            variant.product?.media?.edges.forEach(edge => {
                if (edge.node?.image?.id && edge.node?.id) {
                    const imageNode: ShopifyImageNode = {
                        id: edge.node.image.id,
                        url: edge.node.image.url,
                        altText: edge.node.image.altText,
                        mediaId: edge.node.id,
                    };
                    imageMap.set(imageNode.id, imageNode);
                }
            });

            productsMap.set(handle, {
                productInfo: {
                    productId: variant.product.id,
                    handle: handle,
                    title: variant.product.title,
                    imageUrl: variant.image?.url,
                    allImages: Array.from(imageMap.values())
                },
                variants: [],
                issues: productIssues
            });
        }
        productsMap.get(handle)!.variants.push(variant);
    }
    
    return Array.from(productsMap.values());
  }, [discrepancies, rawDataBySku]);

  const filteredIssuesByProduct = useMemo(() => {
    if (issueFilters.size === allIssueTypes.length) {
      return issuesByProduct;
    }
    return issuesByProduct
      .map(productGroup => ({
        ...productGroup,
        issues: productGroup.issues.filter(issue => issueFilters.has(issue.Field))
      }))
      .filter(productGroup => productGroup.issues.length > 0);
  }, [issuesByProduct, issueFilters, allIssueTypes]);
  
  const allFilteredDiscrepancyKeys = useMemo(() => filteredIssuesByProduct.flatMap(p => p.issues.map(d => `${d.SKU}-${d.Field}`)), [filteredIssuesByProduct]);

  const allFixableFilteredIssueKeys = useMemo(() => {
    return allFilteredDiscrepancyKeys.filter(key => {
        const issueField = key.split('-').slice(1).join('-') as Discrepancy['Field'];
        return isIssueFixable(issueField) && !updatingItems[key];
    });
  }, [allFilteredDiscrepancyKeys, updatingItems]);
  
  const allFixableFilteredIssuesCount = useMemo(() => {
    return filteredIssuesByProduct.flatMap(p => p.issues).filter(d => isIssueFixable(d.Field)).length;
  }, [filteredIssuesByProduct]);

  // Adjust current page if it becomes invalid after items are removed.
  useEffect(() => {
    const totalPages = Math.ceil(filteredMissingProductGroups.length / ITEMS_PER_PAGE);
    const lastPage = Math.max(totalPages, 1);
    if (currentPageMissing > lastPage) {
        setCurrentPageMissing(lastPage);
    }
  }, [filteredMissingProductGroups.length, currentPageMissing]);

  useEffect(() => {
    const totalPages = Math.ceil(filteredIssuesByProduct.length / ITEMS_PER_PAGE);
    const lastPage = Math.max(totalPages, 1);
    if (currentPageIssues > lastPage) {
        setCurrentPageIssues(lastPage);
    }
  }, [filteredIssuesByProduct.length, currentPageIssues]);

  // Paginated Data
  const paginatedMissingGroups = useMemo(() => 
    filteredMissingProductGroups.slice(
        (currentPageMissing - 1) * ITEMS_PER_PAGE,
        currentPageMissing * ITEMS_PER_PAGE
    ), 
  [filteredMissingProductGroups, currentPageMissing]);

  const paginatedIssuesByProduct = useMemo(() =>
    filteredIssuesByProduct.slice(
        (currentPageIssues - 1) * ITEMS_PER_PAGE,
        currentPageIssues * ITEMS_PER_PAGE
    ),
  [filteredIssuesByProduct, currentPageIssues]);

  // Callbacks for actions
  const handleCreateGroup = useCallback(async (group: MissingProductGroup) => {
    const key = group.handle;
    setUpdatingItems(prev => ({ ...prev, [key]: { loading: true, error: undefined } }));
    
    try {
        await onCreateProductGroup(group);
        setUpdatingItems(prev => ({ ...prev, [key]: { loading: false, success: true } }));

        const timerId = window.setTimeout(() => {
            onRemoveItem(key, 'missing');
            setUpdatingItems(prev => { const newState = {...prev}; delete newState[key]; return newState; });
            setSelectedMissing(prev => { const newSet = new Set(prev); newSet.delete(key); return newSet; });
            timeoutIds.current.delete(timerId);
        }, 2000);
        timeoutIds.current.add(timerId);

        if (viewingProductGroup?.handle === key) {
            setViewingProductGroup(null);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        setUpdatingItems(prev => ({ ...prev, [key]: { loading: false, error: message } }));
    }
  }, [onCreateProductGroup, onRemoveItem, viewingProductGroup?.handle]);

  const handleFix = useCallback(async (discrepancy: Discrepancy) => {
    const key = `${discrepancy.SKU}-${discrepancy.Field}`;
    setUpdatingItems(prev => ({ ...prev, [key]: { loading: true, error: undefined } }));

    try {
        await onFixProduct(discrepancy);
        setUpdatingItems(prev => ({ ...prev, [key]: { loading: false, success: true } }));
        
        const timerId = window.setTimeout(() => {
            onRemoveItem(key, 'issues');
            setUpdatingItems(prev => { const newState = {...prev}; delete newState[key]; return newState; });
            setSelectedIssues(prev => { const newSet = new Set(prev); newSet.delete(key); return newSet; });
            timeoutIds.current.delete(timerId);
        }, 2000);
        timeoutIds.current.add(timerId);
       
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        setUpdatingItems(prev => ({ ...prev, [key]: { loading: false, error: message } }));
    }
  }, [onFixProduct, onRemoveItem]);
  
  const handleManageImages = useCallback(async (data: { assignments: {variantId: string, imageId: string | null}[], deletions: {productId: string, mediaIds: string[]}, altTextUpdates: {imageId: string, altText: string}[] }) => {
    if (!managingImagesForProduct) return;
    const key = managingImagesForProduct.productInfo.handle;
    setUpdatingItems(prev => ({...prev, [key]: { loading: true }}));

    try {
        const promises = [];
        if (data.assignments.length > 0) promises.push(onUpdateVariantImages(managingImagesForProduct.productInfo.productId, data.assignments));
        if (data.deletions.mediaIds.length > 0) promises.push(onDeleteProductImages(data.deletions));
        if (data.altTextUpdates.length > 0) promises.push(onUpdateImageAltTexts(data.altTextUpdates));
        
        await Promise.all(promises);
        await del(CACHE_KEY);

        setUpdatingItems(prev => ({...prev, [key]: { loading: false, success: true }}));
        setManagingImagesForProduct(null);

        const timerId = window.setTimeout(() => {
            setUpdatingItems(prev => { const newState = {...prev}; delete newState[key]; return newState; });
            timeoutIds.current.delete(timerId);
        }, 2000);
        timeoutIds.current.add(timerId);

    } catch(err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred.";
        setUpdatingItems(prev => ({...prev, [key]: { loading: false, error: message }}));
    }
  }, [managingImagesForProduct, onUpdateVariantImages, onDeleteProductImages, onUpdateImageAltTexts]);
  
  const handleBulkCreate = useCallback(async () => {
    setIsBulkUpdating(true);
    const groupsToCreate = missingProductGroups.filter(p => selectedMissing.has(p.handle));
    setBulkProgress({ current: 0, total: groupsToCreate.length, message: '', action: 'Creating' });
    const successfullyCreatedHandles: string[] = [];

    for (const group of groupsToCreate) {
        const key = group.handle;
        setBulkProgress(prev => ({ ...prev, current: prev.current + 1, message: group.title }));
        setUpdatingItems(prev => ({ ...prev, [key]: { loading: true } }));
        try {
            await onCreateProductGroup(group);
            successfullyCreatedHandles.push(key);
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            setUpdatingItems(prev => ({ ...prev, [key]: { loading: false, error: message } }));
        }
    }

    setIsBulkUpdating(false);
    setBulkProgress({ current: 0, total: 0, message: '', action: '' });
    if (successfullyCreatedHandles.length > 0) onBulkRemoveItems(successfullyCreatedHandles, 'missing');
    setSelectedMissing(prev => {
        const newSet = new Set(prev);
        successfullyCreatedHandles.forEach(h => newSet.delete(h));
        return newSet;
    });
  }, [missingProductGroups, selectedMissing, onCreateProductGroup, onBulkRemoveItems]);
  
  // Refactored Bulk Fix Logic
  const executeBulkFix = useCallback(async (issuesToFix: Discrepancy[]) => {
    if (issuesToFix.length === 0) return;

    setIsBulkUpdating(true);
    setBulkProgress({ current: 0, total: issuesToFix.length, message: '', action: 'Fixing' });
    await new Promise(resolve => setTimeout(resolve, 0));
    const successfullyFixedKeys: string[] = [];

    for (const issue of issuesToFix) {
        const key = `${issue.SKU}-${issue.Field}`;
        setBulkProgress(prev => ({...prev, current: prev.current + 1, message: `Fixing ${issue.Field} for ${issue.SKU}`}));
        setUpdatingItems(prev => ({ ...prev, [key]: { loading: true } }));
        try {
            await onFixProduct(issue);
            successfullyFixedKeys.push(key);
        } catch (error) {
             const message = error instanceof Error ? error.message : "An unknown error occurred.";
            setUpdatingItems(prev => ({ ...prev, [key]: { loading: false, error: message } }));
        }
    }

    setIsBulkUpdating(false);
    setBulkProgress({ current: 0, total: 0, message: '', action: '' });
    if (successfullyFixedKeys.length > 0) onBulkRemoveItems(successfullyFixedKeys, 'issues');
  }, [onFixProduct, onBulkRemoveItems]);
  
  const handleBulkFix = useCallback(async () => {
    const issuesToFix = filteredIssuesByProduct.flatMap(p => p.issues).filter(d => selectedIssues.has(`${d.SKU}-${d.Field}`) && isIssueFixable(d.Field));
    await executeBulkFix(issuesToFix);
    setSelectedIssues(prev => {
        const newSet = new Set(prev);
        issuesToFix.forEach(issue => newSet.delete(`${issue.SKU}-${issue.Field}`));
        return newSet;
    });
  }, [filteredIssuesByProduct, selectedIssues, executeBulkFix]);

  const handleFixAll = useCallback(async () => {
      const issuesToFix = filteredIssuesByProduct.flatMap(p => p.issues).filter(d => isIssueFixable(d.Field));
      if (issuesToFix.length === 0) return;

      if (!window.confirm(`This will attempt to fix all ${issuesToFix.length} fixable issues matching the current filters. This action cannot be undone. Continue?`)) {
          return;
      }
      await executeBulkFix(issuesToFix);
      setSelectedIssues(new Set());
  }, [filteredIssuesByProduct, executeBulkFix]);

  const toggleIndividualSelection = useCallback((key: string, type: 'missing' | 'issues') => {
      const [selected, setSelected] = type === 'missing' ? [selectedMissing, setSelectedMissing] : [selectedIssues, setSelectedIssues];
      const newSet = new Set(selected);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      setSelected(newSet);
  }, [selectedMissing, selectedIssues]);

  const handleToggleProductSelection = useCallback((productGroup: IssuesByProduct) => {
      const fixableIssueKeysInGroup = productGroup.issues
          .filter(issue => isIssueFixable(issue.Field))
          .map(issue => `${issue.SKU}-${issue.Field}`);

      if (fixableIssueKeysInGroup.length === 0) return;
      const currentlySelectedInGroup = fixableIssueKeysInGroup.filter(key => selectedIssues.has(key));
      const allSelected = currentlySelectedInGroup.length === fixableIssueKeysInGroup.length;

      const newSelectedIssues = new Set(selectedIssues);
      if (allSelected) fixableIssueKeysInGroup.forEach(key => newSelectedIssues.delete(key));
      else fixableIssueKeysInGroup.forEach(key => newSelectedIssues.add(key));
      setSelectedIssues(newSelectedIssues);
  }, [selectedIssues]);

  const toggleRowExpansion = useCallback((handle: string) => {
    setExpandedRows(prev => {
        const newSet = new Set(prev);
        if (newSet.has(handle)) newSet.delete(handle);
        else newSet.add(handle);
        return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback((type: 'missing' | 'issues') => {
      if (type === 'missing') {
          const handlesToSelect = filteredMissingProductHandles.filter(handle => !updatingItems[handle]);
          if (selectedMissing.size === handlesToSelect.length && handlesToSelect.length > 0) setSelectedMissing(new Set());
          else setSelectedMissing(new Set(handlesToSelect));
      } else {
          if (selectedIssues.size === allFixableFilteredIssueKeys.length && allFixableFilteredIssueKeys.length > 0) setSelectedIssues(new Set());
          else setSelectedIssues(new Set(allFixableFilteredIssueKeys));
      }
  }, [filteredMissingProductHandles, updatingItems, selectedMissing, allFixableFilteredIssueKeys, selectedIssues]);
  
  // UI Rendering
  const getTabClassName = (tabName: 'missing' | 'issues') => `whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tabName ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`;
  
  const SummaryCard = ({ icon, title, value, color }: { icon: React.ReactNode, title: string, value: number, color: string}) => (
      <div className="bg-white p-6 rounded-lg shadow-md flex items-center space-x-4">
          <div className={`rounded-full p-3 ${color}`}>{icon}</div>
          <div>
              <p className="text-sm text-slate-500">{title}</p>
              <p className="text-3xl font-bold text-slate-800">{value}</p>
          </div>
      </div>
  );
  
  const BulkActionBar = ({ type }: { type: 'missing' | 'issues' }) => {
    const selectedCount = type === 'missing' ? selectedMissing.size : selectedIssues.size;

    if (isBulkUpdating) {
        return (
            <div className="bg-slate-100 p-3 rounded-t-md flex items-center justify-between sticky top-0 z-10 border-b border-slate-200 w-full">
                <BulkProgressIndicator current={bulkProgress.current} total={bulkProgress.total} message={bulkProgress.message} action={bulkProgress.action as 'Creating' | 'Fixing'} />
            </div>
        );
    }

    if (selectedCount === 0) return null;
    
    let fixableCount = selectedCount;
    if(type === 'issues'){
        const allIssues = filteredIssuesByProduct.flatMap(p => p.issues);
        fixableCount = allIssues.filter(d => selectedIssues.has(`${d.SKU}-${d.Field}`) && isIssueFixable(d.Field)).length;
    }
    
    const buttonText = type === 'missing' ? `Create ${selectedCount} Product(s)` : `Fix ${fixableCount} Item(s)`;

    return (
        <div className="bg-slate-100 p-3 rounded-t-md flex items-center justify-between sticky top-0 z-10 border-b border-slate-200">
            <div>
                <span className="text-sm font-medium text-slate-700">{selectedCount} {type === 'missing' ? 'product(s)' : 'item(s)'} selected</span>
                {type === 'issues' && fixableCount < selectedCount && (<span className="text-xs text-slate-500 ml-2">({fixableCount} are auto-fixable)</span>)}
            </div>
            <button
                onClick={type === 'missing' ? handleBulkCreate : handleBulkFix}
                disabled={isBulkUpdating || (type === 'issues' && fixableCount === 0)}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${type === 'missing' ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'} disabled:bg-slate-400 disabled:cursor-wait`}
            >
                {isBulkUpdating ? <SpinnerIcon /> : (type === 'missing' ? <CreateIcon/> : <FixIcon />)}
                {isBulkUpdating ? 'Processing...' : buttonText}
            </button>
        </div>
    );
  };

  return (
    <>
    {viewingProductGroup && ( <DraftProductPage key={viewingProductGroup.handle} productGroup={viewingProductGroup} onClose={() => setViewingProductGroup(null)} onCreate={handleCreateGroup} isCreating={updatingItems[viewingProductGroup.handle]?.loading || false} createError={updatingItems[viewingProductGroup.handle]?.error} /> )}
    {managingImagesForProduct && ( <ExistingImageManager product={managingImagesForProduct} onClose={() => setManagingImagesForProduct(null)} onSave={handleManageImages} isSaving={updatingItems[managingImagesForProduct.productInfo.handle]?.loading || false} saveError={updatingItems[managingImagesForProduct.productInfo.handle]?.error} /> )}
    {debuggingItem && ( <DebugModal itemData={debuggingItem} onClose={() => setDebuggingItem(null)} /> )}
    
    <div className="max-w-7xl mx-auto p-4 sm:p-8">
       {isPartialAudit && (
            <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-800 p-4 mb-6 rounded-md" role="alert">
                <p className="font-bold flex items-center"><AlertTriangleIcon className="h-5 w-5 mr-2 text-amber-500" />Partial Audit Results</p>
                <p className="text-sm mt-1">This report was generated from a subset of your store's products. The 'Unexpected Clearance Tag' check was not performed. For a complete report including this check, run a new audit and include a full product export file.</p>
            </div>
        )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Audit Report</h1>
            <p className="mt-1 text-lg text-slate-600">Review missing products and data discrepancies.</p>
            {sourceFileNames && sourceFileNames.length > 0 && (
              <div className="mt-4 flex items-start text-sm text-slate-600">
                <FileTextIcon className="h-5 w-5 mr-2 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex flex-wrap items-center">
                  <span>Auditing files:</span>
                  <div className="ml-2 flex flex-wrap gap-x-2 gap-y-1">
                    {sourceFileNames.map(name => (
                      <span key={name} className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{name}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
        </div>
        <div className="flex space-x-2 mt-4 sm:mt-0">
             <button onClick={onExportCsv} className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"> <DownloadIcon /> Export CSV</button>
            <button onClick={onNewAudit} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">Start New Audit</button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <SummaryCard icon={<ArchiveBoxIcon className="h-6 w-6 text-rose-800" />} title="Missing Products & Variants" value={missingProductGroups.length} color="bg-rose-100" />
            <SummaryCard icon={<AlertTriangleIcon className="h-6 w-6 text-amber-800" />} title="Products with Issues" value={issuesByProduct.length} color="bg-amber-100" />
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-slate-200">
        <div className="border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button onClick={() => setActiveTab('missing')} className={getTabClassName('missing')} aria-current={activeTab === 'missing' ? 'page' : undefined}>Missing Products & Variants <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">{missingProductGroups.length}</span></button>
            <button onClick={() => setActiveTab('issues')} className={getTabClassName('issues')} aria-current={activeTab === 'issues' ? 'page' : undefined}>Products with Issues <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{issuesByProduct.length}</span></button>
          </nav>
          <div className="pb-2 flex items-center space-x-2">
            {activeTab === 'missing' && missingProductGroups.length > 0 && (<MissingFilterDropdown selectedFilter={missingProductFilter} onChange={handleMissingFilterChange} />)}
            {activeTab === 'issues' && discrepancies.length > 0 && (
              <>
                <button onClick={handleFixAll} disabled={isBulkUpdating || allFixableFilteredIssuesCount === 0} className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
                    <FixIcon /> <span className="ml-1.5">Fix All Filtered ({allFixableFilteredIssuesCount})</span>
                </button>
                <IssueFilterDropdown allIssueTypes={allIssueTypes} selectedFilters={issueFilters} onChange={handleIssueFilterChange} />
              </>
            )}
          </div>
        </div>

        <div className="mt-6">
          {activeTab === 'missing' && (
            <div>
              <p className="text-sm text-slate-500 mb-4">These products or variants were found in your source file but not in Shopify.</p>
              {filteredMissingProductGroups.length > 0 ? (
                <div className="border border-slate-200 rounded-md">
                  <BulkActionBar type="missing" />
                   <div className="bg-slate-50 flex items-center px-4 py-3 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        <div className="w-12"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={selectedMissing.size > 0 && selectedMissing.size === filteredMissingProductHandles.filter(h => !updatingItems[h]).length && filteredMissingProductHandles.length > 0} ref={input => { if (input) input.indeterminate = selectedMissing.size > 0 && selectedMissing.size < filteredMissingProductHandles.filter(h => !updatingItems[h]).length }} onChange={() => toggleSelectAll('missing')}/></div>
                        <div className="w-12"></div>
                        <div className="flex-1 px-2">Product</div>
                        <div className="w-48 px-2">Variants</div>
                        <div className="w-64 px-2">Action</div>
                    </div>
                  <div className="divide-y divide-slate-200">
                    {paginatedMissingGroups.map((group) => (
                        <MissingRow
                            key={group.handle}
                            group={group}
                            isExpanded={expandedRows.has(group.handle)}
                            status={updatingItems[group.handle]}
                            isSelected={selectedMissing.has(group.handle)}
                            isBulkUpdating={isBulkUpdating}
                            onToggleExpansion={toggleRowExpansion}
                            onToggleSelection={toggleIndividualSelection}
                            onPreview={setViewingProductGroup}
                            onCreate={handleCreateGroup}
                        />
                    ))}
                  </div>
                  <Pagination
                        currentPage={currentPageMissing}
                        totalItems={filteredMissingProductGroups.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={setCurrentPageMissing}
                    />
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                    <ArchiveBoxIcon className="mx-auto h-12 w-12 text-slate-400" />
                    <p className="mt-2 font-semibold">{missingProductGroups.length > 0 ? 'No items match your current filter.' : 'No missing products found. Great!'}</p>
                     {missingProductGroups.length > 0 && missingProductFilter !== 'all' && (<button onClick={() => handleMissingFilterChange('all')} className="mt-4 text-sm font-medium text-indigo-600 hover:underline">Clear Filter</button>)}
                </div>
              )}
            </div>
          )}
          {activeTab === 'issues' && (
             <div>
              <p className="text-sm text-slate-500 mb-4">These products have data issues, either compared to the source file or against Shopify's best practices.</p>
              {filteredIssuesByProduct.length > 0 ? (
                <div className="border border-slate-200 rounded-md">
                  <BulkActionBar type="issues" />
                  <div className="bg-slate-50 flex items-center px-4 py-3 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        <div className="w-12">
                            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                checked={selectedIssues.size > 0 && selectedIssues.size === allFixableFilteredIssueKeys.length && allFixableFilteredIssueKeys.length > 0} 
                                ref={input => { if (input) input.indeterminate = selectedIssues.size > 0 && selectedIssues.size < allFixableFilteredIssueKeys.length }} 
                                onChange={() => toggleSelectAll('issues')} />
                        </div>
                        <div className="w-12"></div>
                        <div className="flex-1 px-2">Product</div>
                        <div className="w-72 px-2">Issue Types</div>
                        <div className="w-56 px-2">Actions</div>
                    </div>
                    <div className="divide-y divide-slate-200">
                        {paginatedIssuesByProduct.map((productGroup) => (
                            <IssuesRow
                                key={productGroup.productInfo.handle}
                                productGroup={productGroup}
                                isExpanded={expandedRows.has(productGroup.productInfo.handle)}
                                updatingItems={updatingItems}
                                selectedIssues={selectedIssues}
                                isBulkUpdating={isBulkUpdating}
                                onToggleExpansion={toggleRowExpansion}
                                onToggleProductSelection={handleToggleProductSelection}
                                onToggleIndividualSelection={toggleIndividualSelection}
                                onManageImages={setManagingImagesForProduct}
                                onFix={handleFix}
                            />
                        ))}
                    </div>
                    <Pagination
                        currentPage={currentPageIssues}
                        totalItems={filteredIssuesByProduct.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={setCurrentPageIssues}
                    />
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <AlertTriangleIcon className="mx-auto h-12 w-12 text-slate-400" />
                   <p className="mt-2 font-semibold">{discrepancies.length > 0 ? 'No items match your current filter.' : 'No product issues found. Great!'}</p>
                    {discrepancies.length > 0 && issueFilters.size < allIssueTypes.length && (<button onClick={() => handleIssueFilterChange(new Set(allIssueTypes))} className="mt-4 text-sm font-medium text-indigo-600 hover:underline">Clear Filter</button>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default ReportScreen;