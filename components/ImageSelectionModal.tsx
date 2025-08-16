import React from 'react';
import { ShopifyImageNode } from '../types';
import { XIcon, AlertTriangleIcon } from './icons';

interface ImageSelectionModalProps {
    images: ShopifyImageNode[];
    onSelectImage: (imageId: string) => void;
    onClose: () => void;
    getImageAltText: (imageId: string) => string;
}

const ImageSelectionModal: React.FC<ImageSelectionModalProps> = ({ images, onSelectImage, onClose, getImageAltText }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-slate-100 rounded-lg shadow-xl w-full max-w-4xl h-[70vh] flex flex-col animate-fade-in-up">
                <header className="flex justify-between items-center p-4 border-b border-slate-200 bg-white rounded-t-lg flex-shrink-0">
                    <h2 className="text-xl font-semibold text-slate-800">Select an Image</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1 rounded-full hover:bg-slate-100 transition-colors" aria-label="Close">
                        <XIcon className="h-6 w-6" />
                    </button>
                </header>

                <main className="p-6 flex-grow overflow-y-auto">
                    {images.length > 0 ? (
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                            {images.map(image => {
                                const altText = getImageAltText(image.id);
                                return (
                                    <button
                                        key={image.id}
                                        onClick={() => onSelectImage(image.id)}
                                        className="relative aspect-square group"
                                        aria-label={`Select image: ${altText || 'untitled'}`}
                                    >
                                        <div className="w-full h-full bg-slate-100 rounded-lg border-2 p-1 transition-all border-slate-200 hover:border-indigo-500 hover:ring-2 hover:ring-indigo-300">
                                            <img src={image.url} alt={altText} className="w-full h-full object-contain rounded-md transition-opacity" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-500">
                            <AlertTriangleIcon className="mx-auto h-12 w-12 text-slate-400" />
                            <p className="mt-2 font-semibold">No Images Available</p>
                            <p className="mt-1 text-sm">This product does not have any images to select from.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default ImageSelectionModal;