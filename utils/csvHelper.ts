
import { Product } from '../types';

const convertToCSV = (data: any[]): string => {
    if (data.length === 0) {
        return '';
    }
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const row of data) {
        const values = headers.map(header => {
            const escaped = ('' + row[header]).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
};

export const exportAuditReportToCsv = (auditResult: any) => {
    const { missingProductGroups, discrepancies } = auditResult;
    
    const missingProducts = missingProductGroups.flatMap((group: any) => group.variants);

    const formattedDiscrepancies = discrepancies.map((d: any) => ({
        SKU: d.SKU,
        ProductName: d.ProductName,
        FieldWithIssue: d.Field,
        FTP_Value: d.FtpValue,
        Shopify_Value: d.ShopifyValue,
    }));

    const missingProductsCsv = convertToCSV(missingProducts.map(({ description, ...rest }: any) => rest));
    const discrepanciesCsv = convertToCSV(formattedDiscrepancies);

    const fullCsvContent =
        'MISSING PRODUCTS\n' +
        (missingProductsCsv || 'No missing products found.\n') +
        '\n\nPRODUCTS WITH ISSUES\n' +
        (discrepanciesCsv || 'No discrepancies found.\n');
    
    const blob = new Blob([fullCsvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
        URL.revokeObjectURL(link.href);
    }
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'shopify_product_audit_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Define potential header names for our required product fields.
const HEADER_ALIASES = {
  handle: ['handle'],
  SKU: ['sku'],
  ProductName: ['productname', 'title'],
  Price: ['price'],
  StockQuantity: ['stockquantity', 'variant inventory qty', 'inventory quantity', 'total inventory'],
  ImageUrl: ['imageurl', 'variant image'],
  description: ['description', 'body (html)'],
  vendor: ['vendor'],
  costPerItem: ['cost per item', 'cost'],
  compareAtPrice: ['compare at price'],
  variantGrams: ['variant grams', 'weight'],
  variantWeightUnit: ['variant weight unit', 'weight unit'],
  barcode: ['variant barcode', 'barcode'],
  productType: ['type'],
  productCategory: ['category', 'product category'],
  seoTitle: ['seo title'],
  seoDescription: ['seo description'],
  tags: ['tags'],
  option1Name: ['option1 name'],
  option1Value: ['option1 value'],
  option2Name: ['option2 name'],
  option2Value: ['option2 value'],
  option3Name: ['option3 name'],
  option3Value: ['option3 value'],
};

const ALL_POSSIBLE_HEADERS = Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[];

export interface ParsedRow {
    lineNumber: number;
    rawData: { [key: string]: string };
    product?: Product;
    warning?: string;
}

export interface ParsedCsvResult {
    rows: ParsedRow[];
    products: Product[];
    headers: string[];
}

// Helper to find the index of a header using its possible aliases.
const findHeaderIndex = (normalizedFileHeaders: string[], internalName: keyof typeof HEADER_ALIASES): number => {
    const aliases = HEADER_ALIASES[internalName] || [];
    for (const alias of aliases) {
        const index = normalizedFileHeaders.indexOf(alias as string);
        if (index !== -1) return index;
    }
    return -1;
};

export const parseCsvToProducts = (csvContent: string, isClearanceFile: boolean = false): Promise<ParsedCsvResult> => {
  return new Promise((resolve, reject) => {
    try {
        const products: Product[] = [];
        const parsedRows: ParsedRow[] = [];
        
        const allRows: string[][] = [];
        if (!csvContent || csvContent.trim() === '') {
            resolve({ products: [], rows: [], headers: [] });
            return;
        }

        let content = csvContent.trim();
        let currentRow: string[] = [];
        let currentField = '';
        let inQuotes = false;

        const firstLineBreak = content.indexOf('\n');
        const headerLine = firstLineBreak === -1 ? content : content.substring(0, firstLineBreak);
        const commaCount = (headerLine.match(/,/g) || []).length;
        const tabCount = (headerLine.match(/\t/g) || []).length;
        const delimiter = (commaCount > 0 || tabCount > 0) && tabCount > commaCount ? '\t' : ',';

        for (let i = 0; i < content.length; i++) {
            const char = content[i];

            if (inQuotes) {
                if (char === '"') {
                    if (i + 1 < content.length && content[i + 1] === '"') {
                        currentField += '"';
                        i++; // Skip the next quote
                    } else {
                        inQuotes = false;
                    }
                } else {
                    currentField += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === delimiter) {
                    currentRow.push(currentField);
                    currentField = '';
                } else if (char === '\n' || char === '\r') {
                    if (char === '\r' && content[i + 1] === '\n') {
                       i++; // handle CRLF
                    }
                    currentRow.push(currentField);
                    allRows.push(currentRow);
                    currentRow = [];
                    currentField = '';
                } else {
                    currentField += char;
                }
            }
        }
        if (currentField || currentRow.length > 0) {
             currentRow.push(currentField);
             allRows.push(currentRow);
        }

      if (allRows.length < 2) {
        resolve({ products: [], rows: [], headers: [] });
        return;
      }

      const fileHeaders = allRows[0].map(h => h.trim());
      const normalizedFileHeaders = fileHeaders.map(h => h.toLowerCase());
      
      const headerIndices: { [key: string]: number } = {};
      const requiredInternalHeaders: (keyof typeof HEADER_ALIASES)[] = ['handle', 'SKU', 'ProductName', 'Price', 'StockQuantity'];

      for (const internalHeader of requiredInternalHeaders) {
        const index = findHeaderIndex(normalizedFileHeaders, internalHeader);
        if (index === -1) {
          const attemptedAliases = HEADER_ALIASES[internalHeader].join('", "');
          throw new Error(`CSV is missing a required column for '${internalHeader}'. Looked for header(s): "${attemptedAliases}".`);
        }
        headerIndices[internalHeader] = index;
      }
      
      for (const internalHeader of ALL_POSSIBLE_HEADERS) {
          headerIndices[internalHeader] = findHeaderIndex(normalizedFileHeaders, internalHeader);
      }
      
      const dataRows = allRows.slice(1);
      for (let i = 0; i < dataRows.length; i++) {
        const fileLineNumber = i + 2;
        const data = dataRows[i];

        if (data.length < fileHeaders.length && data.every(field => field.trim() === '')) {
            continue; // Skip empty rows
        }
        
        while (data.length < fileHeaders.length) {
            data.push('');
        }

        const rawData: { [key: string]: string } = {};
        fileHeaders.forEach((header, index) => {
            rawData[header] = data[index] || '';
        });

        const handleValue = data[headerIndices['handle']];
        const skuValue = data[headerIndices['SKU']];
        if (!handleValue || !skuValue) {
          parsedRows.push({ lineNumber: fileLineNumber, rawData, warning: 'Missing or empty Handle or SKU.' });
          continue;
        }
        
        const priceString = data[headerIndices['Price']];
        const stockString = data[headerIndices['StockQuantity']];

        const price = parseFloat(priceString);
        const stockQuantity = parseInt(stockString, 10);

        if (isNaN(price) || isNaN(stockQuantity)) {
            const warningMsg = `Could not parse Price or StockQuantity. Found Price: '${priceString}', StockQuantity: '${stockString}'.`;
            parsedRows.push({ lineNumber: fileLineNumber, rawData, warning: warningMsg });
            continue;
        }

        const getOptionalString = (key: keyof typeof HEADER_ALIASES): string | undefined => {
            const index = headerIndices[key];
            return (index !== -1 && data[index]) ? data[index] : undefined;
        }

        const getOptionalFloat = (key: keyof typeof HEADER_ALIASES): number | undefined => {
            const strVal = getOptionalString(key);
            if (!strVal) return undefined;
            const num = parseFloat(strVal);
            return isNaN(num) ? undefined : num;
        }

        const productName = data[headerIndices['ProductName']] || 'N/A';
        const imageUrl = getOptionalString('ImageUrl') || `https://via.placeholder.com/150/F3F4F6/9CA3AF?text=${skuValue}`;
        const tagsString = getOptionalString('tags');

        const product: Product = {
          handle: handleValue,
          SKU: skuValue,
          ProductName: productName,
          Price: price,
          StockQuantity: stockQuantity,
          ImageUrl: imageUrl,
          isClearance: isClearanceFile,
          description: getOptionalString('description'),
          vendor: getOptionalString('vendor'),
          costPerItem: getOptionalFloat('costPerItem'),
          compareAtPrice: getOptionalFloat('compareAtPrice'),
          variantGrams: getOptionalFloat('variantGrams'),
          variantWeightUnit: getOptionalString('variantWeightUnit'),
          barcode: getOptionalString('barcode'),
          productType: getOptionalString('productType'),
          productCategory: getOptionalString('productCategory'),
          seoTitle: getOptionalString('seoTitle'),
          seoDescription: getOptionalString('seoDescription'),
          tags: tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : undefined,
          option1Name: getOptionalString('option1Name'),
          option1Value: getOptionalString('option1Value'),
          option2Name: getOptionalString('option2Name'),
          option2Value: getOptionalString('option2Value'),
          option3Name: getOptionalString('option3Name'),
          option3Value: getOptionalString('option3Value'),
        };

        products.push(product);
        parsedRows.push({ lineNumber: fileLineNumber, rawData, product });
      }

      resolve({ products, rows: parsedRows, headers: fileHeaders });
    } catch (e) {
      if (e instanceof Error) {
        reject(e);
      } else {
        reject(new Error(String(e)));
      }
    }
  });
};
