import React, { useState, useMemo, useCallback } from 'react';
import { ShopifyImageNode, ShopifyVariantNode } from '../types';
import { XIcon, SpinnerIcon, CheckCircleSolidIcon, TrashIcon, EditIcon, AlertTriangleIcon, ChevronRightIcon } from './icons';
import ConfirmationModal from './ConfirmationModal';
import ImageSelectionModal from './ImageSelectionModal';

interface IssuesByProduct {
  productInfo: {
    productId: string;
    handle: string;
    title: string;
    imageUrl?: string;
    allImages: ShopifyImageNode[];
  };
  variants: ShopifyVariantNode[];
  issues: any[];
}
interface ExistingImageManagerProps {
    product: IssuesByProduct;
    onClose: () => void;
    onSave: (updates: { 
        assignments: {variantId: string, imageId: string | null}[], 
        deletions: {productId: string, mediaIds: string[]},
        altTextUpdates: {imageId: string, altText: string}[]
    }) => Promise<void>;
    isSaving: boolean;
    saveError?: string;
}

interface OptionImageAssignmentModalProps {
    option: { name: string; values: Set<string> };
    images: ShopifyImageNode[];
    initialAssignments: Map<string, string | null>; // Map from option VALUE to image ID
    onClose: () => void;
    onSave: (assignments: Map<string, string | null>) => void;
    getImageAltText: (imageId: string) => string;
    imagesById: Map<string, ShopifyImageNode>;
}

const OptionImageAssignmentModal: React.FC<OptionImageAssignmentModalProps> = ({ option, images, initialAssignments, onClose, onSave, getImageAltText, imagesById }) => {
    const [assignments, setAssignments] = useState<Map<string, string | null>>(initialAssignments);
    const [isImageSelectorOpen, setIsImageSelectorOpen] = useState(false);
    const [targetValue, setTargetValue] = useState<string | null>(null);

    const handleOpenSelector = (value: string) => {
        setTargetValue(value);
        setIsImageSelectorOpen(true);
    };

    const handleSelectImage = (imageId: string) => {
        if (targetValue) {
            setAssignments(prev => new Map(prev).set(targetValue, imageId));
        }
        setIsImageSelectorOpen(false);
        setTargetValue(null);
    };

    const handleUnassign = (value: string) => {
        setAssignments(prev => new Map(prev).set(value, null));
    };

    const handleSaveChanges = () => {
        onSave(assignments);
    };

    return (
        <>
            {isImageSelectorOpen && (
                <ImageSelectionModal
                    images={images}
                    onClose={() => setIsImageSelectorOpen(false)}
                    onSelectImage={handleSelectImage}
                    getImageAltText={getImageAltText}
                />
            )}
            <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex justify-center items-center p-4 transition-opacity" aria-modal="true" role="dialog">
                <div className="bg-slate-100 rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col animate-fade-in-up">
                    <header className="flex justify-between items-center p-4 border-b border-slate-200 bg-white rounded-t-lg flex-shrink-0">
                        <h2 className="text-xl font-semibold text-slate-800">Assign Images for "{option.name}"</h2>
                         <button onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1 rounded-full hover:bg-slate-100 transition-colors" aria-label="Close">
                            <XIcon className="h-6 w-6" />
                        </button>
                    </header>
                    <main className="p-6 flex-grow overflow-y-auto">
                        <p className="text-sm text-slate-600 mb-4">Set an image for each option value. This will apply the chosen image to all variants with that value.</p>
                        <div className="space-y-3">
                            {Array.from(option.values).sort().map(value => {
                                const imageId = assignments.get(value);
                                const image = imageId ? imagesById.get(imageId) : null;
                                return (
                                    <div key={value} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                        <div className="flex items-center">
                                            <div className="h-12 w-12 rounded-md flex items-center justify-center border bg-white p-0.5">
                                                {image ? (
                                                    <img src={image.url} alt={getImageAltText(image.id)} className="max-h-full max-w-full rounded-sm object-contain" />
                                                ) : (
                                                    <div className="h-full w-full bg-slate-100 rounded-sm"></div>
                                                )}
                                            </div>
                                            <span className="ml-4 text-md font-medium text-slate-800">{value}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {image && (
                                                <button onClick={() => handleUnassign(value)} className="text-sm font-medium text-slate-500 hover:text-rose-600">
                                                    Unassign
                                                </button>
                                            )}
                                            <button onClick={() => handleOpenSelector(value)} className="inline-flex items-center px-3 py-1.5 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                                                {image ? 'Change...' : 'Assign...'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </main>
                    <footer className="flex justify-end items-center p-4 border-t border-slate-200 bg-white rounded-b-lg flex-shrink-0">
                         <button onClick={onClose} className="mr-2 px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleSaveChanges} className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                            Apply Changes
                        </button>
                    </footer>
                </div>
            </div>
        </>
    );
};


const ExistingImageManager: React.FC<ExistingImageManagerProps> = ({ product, onClose, onSave, isSaving, saveError }) => {
    const { productInfo, variants } = product;

    // --- State Management ---
    const [initialState] = useState(() => {
        const initialVariantImageMap = new Map<string, string | null>();
        const firstImageId = productInfo.allImages?.[0]?.id || null;

        for (const variant of variants) {
            // Prioritize the explicit featured image.
            let imageId = variant.image?.id || null;

            // If no featured image, fall back to the first associated media.
            if (!imageId) {
                const firstMediaNode = variant.media?.edges?.[0]?.node;
                if (firstMediaNode?.image?.id) {
                    imageId = firstMediaNode.image.id;
                }
            }
            
            // Auto-assign first image if there's only one variant and it has no image at all.
            if (!imageId && variants.length === 1 && firstImageId) {
                imageId = firstImageId;
            }
            initialVariantImageMap.set(variant.id, imageId);
        }

        return {
            variantImageMap: initialVariantImageMap,
            altTextMap: new Map(productInfo.allImages.map(img => [img.id, img.altText || ''])),
        };
    });
    
    const [variantImageMap, setVariantImageMap] = useState(initialState.variantImageMap);
    const [altTextEdits, setAltTextEdits] = useState(new Map<string, string>());
    const [imagesToDelete, setImagesToDelete] = useState(new Set<string>()); // This will store mediaIds
    const [selectedImageIds, setSelectedImageIds] = useState(new Set<string>());
    const [editingAltTextId, setEditingAltTextId] = useState<string | null>(null);
    const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
    const [dragOverVariantId, setDragOverVariantId] = useState<string | null>(null);

    const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [isImageSelectorOpen, setIsImageSelectorOpen] = useState(false);
    const [targetVariantForSelection, setTargetVariantForSelection] = useState<string | null>(null);
    const [assigningOption, setAssigningOption] = useState<{name: string, values: Set<string>} | null>(null);

    const imagesById = useMemo(() => {
        return new Map(productInfo.allImages.map(image => [image.id, image]));
    }, [productInfo.allImages]);

    const getImageAltText = (imageId: string): string => {
        return altTextEdits.get(imageId) ?? initialState.altTextMap.get(imageId) ?? '';
    };

    const optionsWithValues = useMemo(() => {
        const map = new Map<string, Set<string>>();
        for (const variant of variants) {
            if (variant.selectedOptions) {
                for (const option of variant.selectedOptions) {
                    if (!map.has(option.name)) {
                        map.set(option.name, new Set());
                    }
                    map.get(option.name)!.add(option.value);
                }
            }
        }
        return map;
    }, [variants]);

    // --- Change Detection ---
    const hasUnsavedChanges = useMemo(() => {
        if (isSaving) return false;
        if (imagesToDelete.size > 0) return true;
        if (altTextEdits.size > 0) return true;
        for (const [variantId, imageId] of variantImageMap.entries()) {
            if (initialState.variantImageMap.get(variantId) !== imageId) return true;
        }
        return false;
    }, [variantImageMap, altTextEdits, imagesToDelete, initialState, isSaving]);


    // --- Handlers ---
    const handleClose = () => {
        if (hasUnsavedChanges) {
            setIsConfirmCloseOpen(true);
        } else {
            onClose();
        }
    };
    
    const handleConfirmClose = () => {
        setIsConfirmCloseOpen(false);
        onClose();
    };

    const handleSaveChanges = () => {
        const assignments: { variantId: string; imageId: string | null }[] = [];
        for (const [variantId, imageId] of variantImageMap.entries()) {
            // Only include assignments that have actually changed from the initial state
            if (imageId !== initialState.variantImageMap.get(variantId)) {
                assignments.push({ variantId, imageId }); // imageId is the ProductImage GID or null
            }
        }
        
        const deletions = {
            productId: productInfo.productId,
            mediaIds: Array.from(imagesToDelete)
        };
        
        const altTextUpdates = Array.from(altTextEdits.entries()).map(([imageId, altText]) => ({ imageId, altText }));

        onSave({ assignments, deletions, altTextUpdates });
    };

    const handleUnassignImageFromAllVariants = useCallback((imageIdToUnassign: string) => {
        setVariantImageMap(prevMap => {
            const newMap = new Map(prevMap);
            for (const [variantId, assignedImageId] of newMap.entries()) {
                if (assignedImageId === imageIdToUnassign) {
                    newMap.set(variantId, null);
                }
            }
            return newMap;
        });
    }, []);

    const handleToggleDeleteImage = useCallback((imageId: string) => {
        const imageNode = imagesById.get(imageId);
        const mediaId = imageNode?.mediaId;

        if (!mediaId) {
            alert("This image cannot be deleted because its Media ID is missing. This might be an issue with data from Shopify.");
            return;
        }

        setImagesToDelete(prevDeletions => {
            const newDeletions = new Set(prevDeletions);
            if (newDeletions.has(mediaId)) {
                newDeletions.delete(mediaId);
            } else {
                newDeletions.add(mediaId);
                handleUnassignImageFromAllVariants(imageId);
                // Deselect the image if it's being marked for deletion
                setSelectedImageIds(prevSelected => {
                    const newSelected = new Set(prevSelected);
                    newSelected.delete(imageId);
                    return newSelected;
                });
            }
            return newDeletions;
        });
    }, [handleUnassignImageFromAllVariants, imagesById]);
    
    const handleAltTextChange = (imageId: string, text: string) => {
        setAltTextEdits(prev => new Map(prev).set(imageId, text));
    };

    const handleAltTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, imageId: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setEditingAltTextId(null);
        } else if (e.key === 'Escape') {
            setAltTextEdits(prev => {
                const newMap = new Map(prev);
                newMap.delete(imageId);
                return newMap;
            });
            setEditingAltTextId(null);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, variantId: string) => {
        e.preventDefault();
        if (draggedImageId) {
            setVariantImageMap(prev => new Map(prev).set(variantId, draggedImageId));
            setDraggedImageId(null);
        }
        setDragOverVariantId(null);
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, variantId: string) => {
        e.preventDefault();
        setDragOverVariantId(variantId);
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLTableRowElement>) => {
        setDragOverVariantId(null);
    };

    const handleUnassignImage = (variantId: string) => {
        setVariantImageMap(prev => new Map(prev).set(variantId, null));
    };

    const openImageSelectorForVariant = (variantId: string) => {
        setTargetVariantForSelection(variantId);
        setIsImageSelectorOpen(true);
    };

    const handleSelectImage = (imageId: string) => {
        if (targetVariantForSelection) {
            setVariantImageMap(prev => new Map(prev).set(targetVariantForSelection, imageId));
        }
        setIsImageSelectorOpen(false);
        setTargetVariantForSelection(null);
    };

    const onImageSelectorClose = () => {
        setIsImageSelectorOpen(false);
        setTargetVariantForSelection(null);
    };

    const imagesForSelector = useMemo(() => 
        productInfo.allImages.filter(img => !img.mediaId || !imagesToDelete.has(img.mediaId)),
        [productInfo.allImages, imagesToDelete]
    );

    const handleToggleImageSelection = (imageId: string) => {
        setSelectedImageIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(imageId)) {
                newSet.delete(imageId);
            } else {
                newSet.add(imageId);
            }
            return newSet;
        });
    };

    const availableImages = useMemo(() => 
        productInfo.allImages.filter(img => !img.mediaId || !imagesToDelete.has(img.mediaId)),
        [productInfo.allImages, imagesToDelete]
    );

    const handleToggleSelectAll = () => {
        if (selectedImageIds.size === availableImages.length) {
            setSelectedImageIds(new Set());
        } else {
            setSelectedImageIds(new Set(availableImages.map(img => img.id)));
        }
    };

    const handleDeleteSelected = () => {
        if (selectedImageIds.size > 0) {
            setIsConfirmDeleteOpen(true);
        }
    };

    const handleConfirmDeleteSelected = () => {
        const mediaIdsToDelete = new Set(imagesToDelete);
        const imageIdsToDeleteFromVariants = new Set<string>();

        for (const imageId of selectedImageIds) {
            const imageNode = imagesById.get(imageId);
            const mediaId = imageNode?.mediaId;
            if (mediaId) {
                mediaIdsToDelete.add(mediaId);
                imageIdsToDeleteFromVariants.add(imageId);
            }
        }

        setImagesToDelete(mediaIdsToDelete);

        setVariantImageMap(prevMap => {
            const newMap = new Map(prevMap);
            for (const [variantId, assignedImageId] of newMap.entries()) {
                if (assignedImageId && imageIdsToDeleteFromVariants.has(assignedImageId)) {
                    newMap.set(variantId, null);
                }
            }
            return newMap;
        });
        
        setSelectedImageIds(new Set());
        setIsConfirmDeleteOpen(false);
    };

    const getOptionImageId = useCallback((optionName: string, optionValue: string): string | null | 'multiple' => {
        const matchingVariants = variants.filter(v => 
            v.selectedOptions?.some(opt => opt.name === optionName && opt.value === optionValue)
        );
        if (matchingVariants.length === 0) return null;

        const assignedImageIds = new Set(
            matchingVariants
                .map(v => variantImageMap.get(v.id))
                .filter((id): id is string => !!id && !imagesToDelete.has(imagesById.get(id)?.mediaId || ''))
        );

        if (assignedImageIds.size === 0) return null;
        if (assignedImageIds.size === 1) return Array.from(assignedImageIds)[0];
        return 'multiple';
    }, [variants, variantImageMap, imagesToDelete, imagesById]);

    const getInitialAssignmentsForOption = useCallback((optionName: string, values: Set<string>): Map<string, string | null> => {
        const initialMap = new Map<string, string | null>();
        for (const value of values) {
            const imageId = getOptionImageId(optionName, value);
            if (imageId && imageId !== 'multiple') {
                initialMap.set(value, imageId);
            } else {
                initialMap.set(value, null); // Treat 'multiple' as 'not assigned' for the modal
            }
        }
        return initialMap;
    }, [getOptionImageId]);

    const handleSaveOptionAssignments = (optionName: string, valueToImageIdMap: Map<string, string | null>) => {
        setVariantImageMap(prevMap => {
            const newMap = new Map(prevMap);
            variants.forEach(variant => {
                const variantOption = variant.selectedOptions?.find(opt => opt.name === optionName);
                if (variantOption && valueToImageIdMap.has(variantOption.value)) {
                    const imageId = valueToImageIdMap.get(variantOption.value);
                     // only update if imageId is not undefined, allowing nulls
                    if (imageId !== undefined) {
                        newMap.set(variant.id, imageId);
                    }
                }
            });
            return newMap;
        });
        setAssigningOption(null); // Close the modal
    };


    return (
        <>
            {isConfirmCloseOpen && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setIsConfirmCloseOpen(false)}
                    onConfirm={handleConfirmClose}
                    title="Discard unsaved changes?"
                    message="You have unsaved changes that will be lost. Are you sure you want to close?"
                    confirmButtonText="Discard Changes"
                />
            )}
            {isConfirmDeleteOpen && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setIsConfirmDeleteOpen(false)}
                    onConfirm={handleConfirmDeleteSelected}
                    title={`Delete ${selectedImageIds.size} selected image(s)?`}
                    message="This will mark the selected images for deletion. They will be permanently removed from Shopify when you save your changes. This cannot be undone."
                    confirmButtonText="Delete Selected"
                />
            )}
            {isImageSelectorOpen && targetVariantForSelection && (
                <ImageSelectionModal
                    images={imagesForSelector}
                    onClose={onImageSelectorClose}
                    onSelectImage={handleSelectImage}
                    getImageAltText={getImageAltText}
                />
            )}
            {assigningOption && (
                <OptionImageAssignmentModal
                    option={assigningOption}
                    images={imagesForSelector}
                    initialAssignments={getInitialAssignmentsForOption(assigningOption.name, assigningOption.values)}
                    onClose={() => setAssigningOption(null)}
                    onSave={(newAssignments) => handleSaveOptionAssignments(assigningOption.name, newAssignments)}
                    getImageAltText={getImageAltText}
                    imagesById={imagesById}
                />
            )}
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity" aria-modal="true" role="dialog">
                <div className="bg-slate-100 rounded-lg shadow-xl w-full max-w-7xl h-[95vh] flex flex-col animate-fade-in-up">
                    <header className="flex justify-between items-center p-4 border-b border-slate-200 bg-white rounded-t-lg flex-shrink-0">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-800">Manage Images</h2>
                            <p className="text-sm text-slate-500 truncate max-w-lg" title={productInfo.title}>{productInfo.title}</p>
                        </div>
                        <button onClick={handleClose} className="text-slate-500 hover:text-slate-800 p-1 rounded-full hover:bg-slate-100 transition-colors" aria-label="Close">
                            <XIcon className="h-6 w-6" />
                        </button>
                    </header>

                    <main className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 overflow-hidden">
                        {/* Left Column: Image Gallery */}
                        <div className="bg-white flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-slate-200 flex-shrink-0">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-medium text-slate-900">
                                        Image Gallery ({productInfo.allImages.length})
                                    </h3>
                                    {availableImages.length > 0 && (
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                id="select-all-images-checkbox"
                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={selectedImageIds.size > 0 && selectedImageIds.size === availableImages.length}
                                                ref={input => { if (input) input.indeterminate = selectedImageIds.size > 0 && selectedImageIds.size < availableImages.length; }}
                                                onChange={handleToggleSelectAll}
                                                aria-label="Select all available images"
                                            />
                                            <label htmlFor="select-all-images-checkbox" className="ml-2 text-sm font-medium text-slate-700">
                                                Select All
                                            </label>
                                        </div>
                                    )}
                                </div>
                                {availableImages.length > 0 && (
                                    <div className={`mt-2 h-10 flex items-center justify-between transition-all duration-300 ${selectedImageIds.size > 0 ? 'opacity-100' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
                                        <p className="text-sm font-medium text-slate-700">
                                            {selectedImageIds.size} selected
                                        </p>
                                        <button 
                                            onClick={handleDeleteSelected}
                                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-colors"
                                        >
                                            <TrashIcon className="h-4 w-4 mr-1.5" />
                                            Delete Selected
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 overflow-y-auto">
                                {productInfo.allImages.length > 0 ? (
                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
                                        {productInfo.allImages.map(image => {
                                            const isEditingAlt = editingAltTextId === image.id;
                                            const isDeleted = image.mediaId ? imagesToDelete.has(image.mediaId) : false;
                                            const isSelected = selectedImageIds.has(image.id);
                                            return (
                                                <div key={image.id} className="relative aspect-square group" draggable={!isDeleted && !isSelected} onDragStart={() => !isDeleted && !isSelected && setDraggedImageId(image.id)} onDragEnd={() => setDraggedImageId(null)}>
                                                    <div className={`w-full h-full bg-slate-100 rounded-lg border-2 p-1 transition-all ${isDeleted ? 'border-rose-300' : isSelected ? 'border-indigo-500 ring-2 ring-indigo-300' : 'border-slate-200'} ${draggedImageId === image.id ? 'opacity-50 scale-95 shadow-lg' : ''} ${isDeleted || isSelected ? '' : 'cursor-grab'}`}>
                                                        <img src={image.url} alt={getImageAltText(image.id)} className={`w-full h-full object-contain rounded-md transition-opacity ${isDeleted ? 'opacity-30' : ''}`} />
                                                        {isDeleted && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <span className="bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow">DELETED</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!isDeleted && (
                                                        <div className={`absolute top-1 left-1 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
                                                            <input 
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => handleToggleImageSelection(image.id)}
                                                                className="h-5 w-5 rounded border-slate-400 text-indigo-600 shadow-sm focus:ring-indigo-500"
                                                                aria-label={`Select image ${getImageAltText(image.id)}`}
                                                            />
                                                        </div>
                                                    )}
                                                    {isEditingAlt ? (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-95 p-2 rounded-lg border-2 border-indigo-500 shadow-lg z-20">
                                                            <textarea 
                                                                value={getImageAltText(image.id)} 
                                                                onChange={e => handleAltTextChange(image.id, e.target.value)}
                                                                onKeyDown={e => handleAltTextKeyDown(e, image.id)}
                                                                className="w-full h-16 text-xs border border-slate-300 rounded-md p-1 focus:ring-1 focus:ring-indigo-500" 
                                                                placeholder="Alt text..."
                                                                autoFocus
                                                            />
                                                            <button onClick={() => setEditingAltTextId(null)} className="mt-1 text-xs font-bold text-indigo-600 hover:underline">Done</button>
                                                        </div>
                                                    ) : (
                                                        <div className="absolute top-0 right-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                            <button onClick={() => setEditingAltTextId(image.id)} title="Edit alt text" disabled={isDeleted} className="p-1.5 bg-white text-slate-600 hover:bg-slate-600 hover:text-white rounded-bl-lg rounded-tr-lg shadow disabled:opacity-50 disabled:cursor-not-allowed">
                                                                <EditIcon className="h-4 w-4" />
                                                            </button>
                                                            <button onClick={() => handleToggleDeleteImage(image.id)} title={isDeleted ? "Undo delete" : "Mark for deletion"} className={`p-1.5 bg-white rounded-bl-lg shadow transition-colors ${isDeleted ? 'text-amber-600 hover:bg-amber-500 hover:text-white' : 'text-rose-500 hover:bg-rose-500 hover:text-white'}`}>
                                                                <TrashIcon className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                     <div className="text-center py-12 text-slate-500">
                                        <AlertTriangleIcon className="mx-auto h-12 w-12 text-slate-400" />
                                        <p className="mt-2 font-semibold">No Images Found</p>
                                        <p className="mt-1 text-sm">This product does not have any images in Shopify.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Variant List */}
                        <div className="bg-slate-50 flex flex-col overflow-hidden">
                             <div className="p-4 border-b border-slate-200 flex-shrink-0 bg-white">
                                <h3 className="text-lg font-medium text-slate-800 mb-2">Assign Images by Option</h3>
                                <p className="text-sm text-slate-500 mb-4">A faster way to assign images to all variants that share an option (e.g., assign to all "Red" variants at once).</p>
                                <div className="space-y-2">
                                    {Array.from(optionsWithValues.keys()).map(optionName => (
                                        <div key={optionName} className="flex items-center justify-between p-3 bg-slate-100 rounded-md border border-slate-200 hover:bg-slate-200/70">
                                            <span className="text-sm font-medium text-slate-800">{optionName}</span>
                                            <button 
                                                onClick={() => setAssigningOption({ name: optionName, values: optionsWithValues.get(optionName)! })}
                                                className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
                                            >
                                                Assign Images...
                                                <ChevronRightIcon className="h-4 w-4 ml-1" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <h3 className="p-4 text-lg font-medium text-slate-900 border-b border-t border-slate-200 flex-shrink-0 bg-slate-50">
                                Individual Variants ({variants.length})
                            </h3>
                            <div className="overflow-y-auto">
                                <table className="min-w-full">
                                    <thead className="bg-slate-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-20">Image</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SKU & Options</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                        {variants.map(variant => {
                                            const assignedImageId = variantImageMap.get(variant.id);
                                            const assignedImage = assignedImageId ? imagesById.get(assignedImageId) : null;
                                            const isImageDeleted = assignedImage?.mediaId ? imagesToDelete.has(assignedImage.mediaId) : false;

                                            return (
                                                <tr key={variant.id} 
                                                    onDrop={(e) => handleDrop(e, variant.id)} 
                                                    onDragOver={(e) => handleDragOver(e, variant.id)}
                                                    onDragLeave={handleDragLeave}
                                                    className={`transition-colors ${dragOverVariantId === variant.id ? 'bg-indigo-100' : ''}`}>
                                                    <td className="p-2 align-middle">
                                                        <div className="relative group/variant-image">
                                                            <button
                                                                type="button"
                                                                onClick={() => openImageSelectorForVariant(variant.id)}
                                                                className={`h-16 w-16 rounded-md flex items-center justify-center border-2 transition-colors border-slate-200 ${assignedImage ? 'bg-slate-50 p-1 hover:bg-slate-100' : 'bg-slate-100 hover:bg-indigo-50'}`}
                                                                aria-label={`Assign image for variant ${variant.sku}`}
                                                            >
                                                                {assignedImage ? (
                                                                    <img src={assignedImage.url} alt={getImageAltText(assignedImage.id) || ''} className={`max-h-full max-w-full rounded-sm object-contain ${isImageDeleted ? 'opacity-40' : ''}`}/>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400 text-center">Assign</span>
                                                                )}
                                                                {isImageDeleted && <div className="absolute inset-0 bg-rose-500/30 rounded-md"></div>}
                                                            </button>
                                                            {assignedImage && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUnassignImage(variant.id)}
                                                                    title="Unassign image"
                                                                    className="absolute -top-1 -right-1 z-10 p-0.5 bg-slate-600 text-white hover:bg-rose-500 rounded-full shadow-md transition-colors opacity-0 group-hover/variant-image:opacity-100 focus:opacity-100"
                                                                    aria-label={`Unassign image from variant ${variant.sku}`}
                                                                >
                                                                    <XIcon className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 align-middle">
                                                        <p className="text-sm font-medium text-slate-800">{variant.sku}</p>
                                                        {variant.selectedOptions && variant.selectedOptions.length > 0 ? (
                                                            <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                                                                {variant.selectedOptions.map(opt => (
                                                                    <div key={opt.name}>
                                                                        <span className="font-semibold">{opt.name}:</span> {opt.value}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-500">Default</p>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </main>

                    <footer className="flex justify-between items-center p-4 border-t border-slate-200 bg-white rounded-b-lg flex-shrink-0">
                        <div>
                            {saveError && <p className="text-sm text-rose-600 flex items-center"><AlertTriangleIcon className="h-4 w-4 mr-2" />Error: {saveError}</p>}
                        </div>
                        <div className="flex items-center">
                            <button onClick={handleClose} className="mr-2 px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveChanges} 
                                disabled={isSaving || !hasUnsavedChanges} 
                                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors w-32"
                            >
                                {isSaving ? <SpinnerIcon /> : <CheckCircleSolidIcon />}
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </footer>
                </div>
            </div>
        </>
    );
};

export default ExistingImageManager;