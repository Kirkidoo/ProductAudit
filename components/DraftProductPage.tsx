

import React, { useState, useMemo } from 'react';
import { MissingProductGroup, Product, ProductImage } from '../types';
import { SpinnerIcon, CreateIcon, XIcon } from './icons';
import ImageManagerModal from './ImageManagerModal';

interface DraftProductPageProps {
  productGroup: MissingProductGroup;
  onClose: () => void;
  onCreate: (productGroup: MissingProductGroup) => Promise<void>;
  isCreating: boolean;
  createError?: string;
}

const InfoSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <section className={`bg-white p-6 rounded-lg shadow-sm border border-slate-200 ${className}`}>
        <h2 className="text-lg font-medium text-slate-900 mb-4">{title}</h2>
        {children}
    </section>
);

const EditableInput: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string, isTextarea?: boolean; rows?: number }> = 
({ label, value, onChange, placeholder, isTextarea = false, rows = 5 }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        {isTextarea ? (
             <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
             className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" />
        ) : (
            <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" />
        )}
    </div>
);


const DraftProductPage: React.FC<DraftProductPageProps> = ({ productGroup, onClose, onCreate, isCreating, createError }) => {
  const [isImageManagerOpen, setIsImageManagerOpen] = useState(false);
  const [editableGroup, setEditableGroup] = useState<MissingProductGroup>(productGroup);

  const handleCreate = async () => {
    await onCreate(editableGroup);
  };

  const handleSaveImageGroups = (updatedImages: ProductImage[]) => {
    setEditableGroup(prev => ({ ...prev, images: updatedImages }));
    setIsImageManagerOpen(false);
  };
  
  const handleInputChange = (field: keyof MissingProductGroup, value: string) => {
      setEditableGroup(prev => ({ ...prev, [field]: value }));
  };

  const optionNames = [editableGroup.option1Name, editableGroup.option2Name, editableGroup.option3Name].filter((n): n is string => !!n && n.trim() !== '');

  const imageGroups = useMemo(() => {
    const groups = new Map<string, ProductImage[]>();
    if (!editableGroup.images) return groups;
    for (const image of editableGroup.images) {
      if (!groups.has(image.groupId)) {
        groups.set(image.groupId, []);
      }
      groups.get(image.groupId)!.push(image);
    }
    return groups;
  }, [editableGroup.images]);

  return (
    <>
      {isImageManagerOpen && (
        <ImageManagerModal
          productGroup={editableGroup}
          onClose={() => setIsImageManagerOpen(false)}
          onSave={handleSaveImageGroups}
        />
      )}
      <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4 transition-opacity" aria-modal="true" role="dialog">
        <div className="bg-slate-100 rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col animate-fade-in-up">
          {/* Header */}
          <header className="flex justify-between items-center p-4 border-b border-slate-200 bg-white rounded-t-lg flex-shrink-0">
            <h2 className="text-xl font-semibold text-slate-800">Product Draft Preview</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1 rounded-full hover:bg-slate-100 transition-colors">
              <XIcon className="h-6 w-6" />
            </button>
          </header>

          {/* Content */}
          <main className="p-6 flex-grow overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Col - Title, Description, Media, Variants */}
              <div className="lg:col-span-2 space-y-6">
                <InfoSection title="Product Details">
                  <div className="space-y-4">
                     <EditableInput label="Title" value={editableGroup.title} onChange={(val) => handleInputChange('title', val)} />
                     <EditableInput 
                        label="Description (HTML)"
                        value={editableGroup.description || ''} 
                        onChange={(val) => handleInputChange('description', val)} 
                        isTextarea={true}
                        rows={8}
                    />
                  </div>
                </InfoSection>
                <InfoSection title="Media">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-slate-500">Primary images for each group. Click 'Manage' to group similar images.</p>
                    <button 
                        onClick={() => setIsImageManagerOpen(true)}
                        className="inline-flex items-center px-3 py-1.5 border border-slate-300 text-xs font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                        Manage Images
                    </button>
                  </div>
                   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {Array.from(imageGroups.entries()).map(([groupId, imagesInGroup]) => {
                          const primaryImage = imagesInGroup[0];
                          const count = imagesInGroup.length;
                          return (
                              <div key={groupId} className="relative aspect-square bg-slate-50 rounded-md border border-slate-200 p-2">
                                  <img src={primaryImage.originalSrc} alt={primaryImage.altText || `Product image`} className="w-full h-full object-contain rounded-md" />
                                  {count > 1 && (
                                    <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center ring-2 ring-white" title={`${count} images in this group`}>
                                      {count}
                                    </span>
                                  )}
                              </div>
                          );
                      })}
                      {imageGroups.size === 0 && <p className="italic text-slate-500">No images provided.</p>}
                   </div>
                </InfoSection>
                <InfoSection title={`Variants (${editableGroup.variants.length})`}>
                   <div className="overflow-x-auto -mx-6">
                      <table className="min-w-full">
                          <thead className="bg-slate-50">
                              <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">SKU</th>
                                  {optionNames.map(name => (
                                      <th key={name} className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{name}</th>
                                  ))}
                                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Price</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Stock</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Weight</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Barcode</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                              {editableGroup.variants.map(variant => (
                                  <tr key={variant.SKU}>
                                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{variant.SKU}</td>
                                      {optionNames.map(name => {
                                          let value = '-';
                                          if (name === editableGroup.option1Name) value = variant.option1Value || '-';
                                          else if (name === editableGroup.option2Name) value = variant.option2Value || '-';
                                          else if (name === editableGroup.option3Name) value = variant.option3Value || '-';
                                          return <td key={name} className="px-4 py-3 text-sm text-slate-600">{value}</td>;
                                      })}
                                      <td className="px-4 py-3 text-sm text-slate-600">${variant.Price.toFixed(2)}</td>
                                      <td className="px-4 py-3 text-sm text-slate-600">{variant.StockQuantity}</td>
                                      <td className="px-4 py-3 text-sm text-slate-600">{variant.variantGrams ? `${variant.variantGrams} ${variant.variantWeightUnit || 'g'}` : '-'}</td>
                                      <td className="px-4 py-3 text-sm text-slate-600">{variant.barcode || '-'}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                   </div>
                </InfoSection>
              </div>

              {/* Right Col - Org, SEO */}
              <div className="lg:col-span-1 space-y-6">
                 <InfoSection title="Organization">
                      <div className="space-y-4">
                          <EditableInput label="Vendor" value={editableGroup.vendor || ''} onChange={(val) => handleInputChange('vendor', val)} placeholder="e.g. Nike" />
                          <EditableInput label="Product Type" value={editableGroup.productType || ''} onChange={(val) => handleInputChange('productType', val)} placeholder="e.g. T-Shirt" />
                           <div>
                                <label className="block text-sm font-medium text-slate-700">Collection</label>
                                <input 
                                    type="text" 
                                    value={editableGroup.productCategory || 'N/A'} 
                                    readOnly 
                                    disabled 
                                    className="mt-1 block w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm shadow-sm cursor-not-allowed"
                                />
                            </div>
                      </div>
                 </InfoSection>
                 <InfoSection title="Search engine listing">
                    <div className="space-y-4">
                        <EditableInput label="SEO Title" value={editableGroup.seoTitle || ''} onChange={(val) => handleInputChange('seoTitle', val)} placeholder="A catchy title for search engines"/>
                        <EditableInput label="SEO Description" value={editableGroup.seoDescription || ''} onChange={(val) => handleInputChange('seoDescription', val)} placeholder="A compelling summary for search results" isTextarea={true}/>
                         <div>
                            <label className="block text-sm font-medium text-slate-700">URL Handle</label>
                             <div className="mt-1 flex rounded-md shadow-sm">
                                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">/products/</span>
                                <input type="text" value={editableGroup.handle} readOnly disabled className="flex-1 block w-full rounded-none rounded-r-md sm:text-sm border-slate-300 px-3 py-2 bg-slate-100 cursor-not-allowed"/>
                             </div>
                         </div>
                    </div>
                 </InfoSection>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="flex justify-end items-center p-4 border-t border-slate-200 bg-white rounded-b-lg flex-shrink-0">
            {createError && <p className="text-sm text-rose-600 mr-4 max-w-sm truncate" title={createError}>Error: {createError}</p>}
            <button onClick={onClose} className="mr-2 px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={isCreating} className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-wait transition-colors w-48">
              {isCreating ? <SpinnerIcon /> : <CreateIcon />}
              {isCreating ? 'Creating...' : 'Create Product'}
            </button>
          </footer>
        </div>
      </div>
    </>
  );
};

export default DraftProductPage;