
import React, { useState } from 'react';
import { XIcon } from './icons';

interface TagInputProps {
  tags: string[];
  setTags: (tags: string[]) => void;
  placeholder?: string;
}

const TagInput: React.FC<TagInputProps> = ({ tags, setTags, placeholder }) => {
    const [inputValue, setInputValue] = useState('');

    const removeTag = (indexToRemove: number) => {
        setTags(tags.filter((_, index) => index !== indexToRemove));
    };

    const addTag = (tag: string) => {
        const trimmedTag = tag.trim();
        if (trimmedTag && !tags.includes(trimmedTag)) {
            setTags([...tags, trimmedTag]);
        }
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(inputValue);
        }
    };
    
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const paste = e.clipboardData.getData('text');
        const tagsToPaste = paste.split(/[,;\n]/).map(tag => tag.trim()).filter(Boolean);
        if (tagsToPaste.length > 0) {
            const newTags = [...tags, ...tagsToPaste.filter(tag => !tags.includes(tag))];
            setTags(newTags);
            setInputValue('');
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-2 p-2 bg-white border border-slate-300 rounded-md shadow-sm focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
            {tags.map((tag, index) => (
                <div key={index} className="flex items-center bg-indigo-100 text-indigo-800 text-sm font-medium px-2 py-1 rounded-md">
                    <span>{tag}</span>
                    <button
                        type="button"
                        className="ml-1.5 -mr-0.5 text-indigo-500 hover:text-indigo-800"
                        onClick={() => removeTag(index)}
                        aria-label={`Remove ${tag}`}
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>
            ))}
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={tags.length === 0 ? placeholder : ''}
                className="flex-grow bg-transparent focus:outline-none text-sm text-slate-900 placeholder-slate-400 min-w-[100px]"
            />
        </div>
    );
};

export default TagInput;
