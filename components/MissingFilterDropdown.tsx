
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon } from './icons';

export type MissingFilterType = 'all' | 'new_product' | 'new_variant';

interface MissingFilterDropdownProps {
  selectedFilter: MissingFilterType;
  onChange: (newFilter: MissingFilterType) => void;
}

const filterOptions: { key: MissingFilterType; label: string }[] = [
  { key: 'all', label: 'Show All' },
  { key: 'new_product', label: 'New Products Only' },
  { key: 'new_variant', label: 'New Variants Only' },
];

const MissingFilterDropdown: React.FC<MissingFilterDropdownProps> = ({ selectedFilter, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);
    
    const currentLabel = filterOptions.find(opt => opt.key === selectedFilter)?.label || 'Filter';

    return (
        <div className="relative inline-block text-left" ref={wrapperRef}>
            <div>
                <button
                    type="button"
                    className="inline-flex justify-center w-full rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 focus:ring-indigo-500"
                    id="missing-filter-button"
                    aria-expanded="true"
                    aria-haspopup="true"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {currentLabel}
                    <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" />
                </button>
            </div>

            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-20" role="menu" aria-orientation="vertical" aria-labelledby="missing-filter-button">
                    <div className="py-1" role="none">
                        {filterOptions.map((option) => (
                            <a
                                key={option.key}
                                href="#"
                                onClick={(e) => { 
                                    e.preventDefault(); 
                                    onChange(option.key);
                                    setIsOpen(false);
                                }}
                                className="text-slate-700 block px-4 py-2 text-sm hover:bg-slate-100 flex items-center justify-between"
                                role="menuitem"
                            >
                                <span>{option.label}</span>
                                {selectedFilter === option.key && <CheckIcon className="h-5 w-5 text-indigo-600" />}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MissingFilterDropdown;
