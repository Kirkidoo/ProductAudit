
import React, { useState, useEffect } from 'react';
import { ProductImage, MissingProductGroup, Product } from '../types';
import { XIcon } from './icons';

interface ImageManagerModalProps {
    productGroup: MissingProductGroup;
    onClose: () => void;
    onSave: (updatedImages: ProductImage[]) => void;
}

const ImageManagerModal: React.FC<ImageManagerModalProps> = ({ productGroup, onClose, onSave }) => {
    const [editedImages, setEditedImages] = useState<ProductImage[]>(productGroup.images);
    const [selectedOption, setSelectedOption] = useState<string>('');
    
    const { variants, option1Name, option2Name, option3Name } = productGroup;
    const optionNames = [option1Name, option2Name, option3Name].filter(Boolean) as string[];

    // Effect to sync state with props
    useEffect(() => {
        setEditedImages(productGroup.images);
    }, [productGroup.images]);

    const handleGroupIdChange = (src: string, newGroupId: string) => {
        setEditedImages(prevImages =>
            prevImages.map(img =>
                img.originalSrc === src ? { ...img, groupId: newGroupId.trim() } : img
            )
        );
    };
    
    const handleAutoGroup = () => {
        if (!selectedOption) return;

        const optionMap: { name: string | undefined; valueKey: keyof Product }[] = [
            { name: option1Name, valueKey: 'option1Value' },
            { name: option2Name, valueKey: 'option2Value' },
            { name: option3Name, valueKey: 'option3Value' },
        ];
        
        const matchedOption = optionMap.find(opt => opt.name === selectedOption);
        if (!matchedOption) return;

        const imageToOptionValueMap = new Map<string, string>();

        for (const variant of variants) {
            if (!variant.ImageUrl) continue;
            
            const optionValue = variant[matchedOption.valueKey];

            if (optionValue) {
                imageToOptionValueMap.set(variant.ImageUrl, String(optionValue));
            }
        }
        
        const newImages = editedImages.map(image => {
            const optionValue = imageToOptionValueMap.get(image.originalSrc);
            if (optionValue) {
                return { ...image, groupId: optionValue };
            }
            return image;
        });

        setEditedImages(newImages);
    };

    const handleSave = () => {
        onSave(editedImages);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity" aria-modal="true" role="dialog">
            <div className="bg-slate-100 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col animate-fade-in-up">
                <header className="flex justify-between items-center p-4 border-b border-slate-200 bg-white rounded-t-lg flex-shrink-0">
                    <h2 className="text-xl font-semibold text-slate-800">Manage Product Images</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1 rounded-full hover:bg-slate-100 transition-colors">
                        <XIcon className="h-6 w-6" />
                    </button>
                </header>

                <main className="p-6 flex-grow overflow-y-auto">
                    <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-4 mb-6 rounded-md">
                        <p className="font-bold">How to group images:</p>
                        <p className="text-sm">To treat multiple images as the same (e.g., different variant images that are identical), assign them the same Group ID. The app will only upload one image per group and associate all variants in that group with it.</p>
                    </div>
                    
                    {optionNames.length > 0 && (
                        <div className="flex items-center gap-4 p-4 mb-6 bg-slate-200 rounded-md border border-slate-300">
                            <strong className="text-sm font-medium text-slate-800">Quick Grouping:</strong>
                            <label htmlFor="group-by-option" className="text-sm text-slate-700">Group by variant option</label>
                            <select 
                                id="group-by-option"
                                value={selectedOption}
                                onChange={(e) => setSelectedOption(e.target.value)}
                                className="block w-48 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">-- Select an option --</option>
                                {optionNames.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                            <button
                                onClick={handleAutoGroup}
                                disabled={!selectedOption}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all"
                            >
                                Apply
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {editedImages.map((image) => (
                            <div key={image.originalSrc} className="border border-slate-200 rounded-lg p-2 bg-white shadow-sm flex flex-col">
                                <div className="aspect-square bg-slate-50 rounded-md overflow-hidden flex-grow">
                                    <img src={image.originalSrc} alt={image.altText || `Image for ${productGroup.title}`} className="w-full h-full object-contain" />
                                </div>
                                <div className="mt-2">
                                    <label htmlFor={`group-id-${image.originalSrc}`} className="block text-xs font-medium text-slate-500 mb-1">Group ID</label>
                                    <input
                                        id={`group-id-${image.originalSrc}`}
                                        type="text"
                                        value={image.groupId}
                                        onChange={(e) => handleGroupIdChange(image.originalSrc, e.target.value)}
                                        className="w-full text-center px-2 py-1 bg-white border-slate-400 rounded-md text-sm shadow-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-semibold"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </main>

                <footer className="flex justify-end items-center p-4 border-t border-slate-200 bg-white rounded-b-lg flex-shrink-0">
                    <button onClick={onClose} className="mr-2 px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                        Save Image Groups
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ImageManagerModal;
