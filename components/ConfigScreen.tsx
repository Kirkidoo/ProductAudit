
import React, { useState } from 'react';
import { ShopifyCredentials } from '../types';
import { ShopifyIcon, AlertTriangleIcon, SpinnerIcon, CopyIcon, CheckIcon } from './icons';

interface ConfigScreenProps {
  onConfigSubmit: (shopifyCreds: ShopifyCredentials) => void;
  isLoading: boolean;
}

const ConfigScreen: React.FC<ConfigScreenProps> = ({ onConfigSubmit, isLoading }) => {
  const [shopifyCreds, setShopifyCreds] = useState<ShopifyCredentials>({ 
    storeName: process.env.SHOPIFY_STORE_NAME || '', 
    adminApiAccessToken: process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || '',
    useCorsProxy: true,
  });
  const [isTokenCopied, setIsTokenCopied] = useState(false);

  const handleShopifyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setShopifyCreds({ 
        ...shopifyCreds, 
        [name]: type === 'checkbox' ? checked : value 
    });
  };
  
  const handleCopyToken = () => {
    if (!shopifyCreds.adminApiAccessToken) return;
    navigator.clipboard.writeText(shopifyCreds.adminApiAccessToken).then(() => {
      setIsTokenCopied(true);
      setTimeout(() => setIsTokenCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const isFormValid = shopifyCreds.storeName && shopifyCreds.adminApiAccessToken;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid && !isLoading) {
      const cleanedCreds = {
          ...shopifyCreds,
          storeName: shopifyCreds.storeName.trim().replace(/\/$/, ''),
      };
      onConfigSubmit(cleanedCreds);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Get Started</h1>
        <p className="mt-2 text-lg text-slate-600">Enter your Shopify store details to begin the audit.</p>
      </div>
      
      <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-4 mb-8 rounded-md" role="alert">
        <p className="font-bold flex items-center"><AlertTriangleIcon className="h-5 w-5 mr-2 text-blue-500" />Important Note</p>
        <ul className="list-disc list-inside text-sm space-y-1 mt-2">
            <li>This app connects directly to the Shopify Admin API from your browser.</li>
            <li>A CORS proxy is enabled by default. This is useful for local development but may not be needed if you use a browser extension.</li>
            <li>Never expose your Admin API access token in a public application. This tool is for internal use only.</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
            <h2 className="text-2xl font-semibold text-slate-800 mb-4 flex items-center">
              <span className="text-indigo-600 font-bold">1.</span> <span className="ml-3">Shopify Store Details</span>
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="storeName" className="block text-sm font-medium text-slate-700">Store Domain</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                   <input type="text" name="storeName" id="storeName" value={shopifyCreds.storeName} onChange={handleShopifyChange} className="focus:ring-indigo-500 focus:border-indigo-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-slate-300 px-3 py-2 placeholder-slate-500" placeholder="your-store-name" required />
                   <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">.myshopify.com</span>
                </div>
              </div>
              <div>
                <label htmlFor="adminApiAccessToken" className="block text-sm font-medium text-slate-700">Admin API Access Token</label>
                <div className="mt-1 relative">
                    <input 
                        type="password" 
                        name="adminApiAccessToken" 
                        id="adminApiAccessToken" 
                        value={shopifyCreds.adminApiAccessToken} 
                        onChange={handleShopifyChange} 
                        placeholder="shpat_..." 
                        className="block w-full px-3 py-2 pr-10 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" 
                        required 
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <button
                            type="button"
                            onClick={handleCopyToken}
                            className="text-slate-500 hover:text-slate-700 focus:outline-none disabled:text-slate-300 disabled:cursor-not-allowed"
                            aria-label="Copy API Token"
                            title="Copy API Token"
                            disabled={!shopifyCreds.adminApiAccessToken || isTokenCopied}
                        >
                            {isTokenCopied ? (
                                <CheckIcon className="h-5 w-5 text-green-500" />
                            ) : (
                                <CopyIcon className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Create a custom app and find this in your Shopify Admin.
                  <a href="https://shopify.dev/docs/apps/auth/admin-app-access-tokens" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 hover:underline ml-1">Learn how</a>.
                </p>
              </div>
               <div className="relative flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="useCorsProxy"
                      name="useCorsProxy"
                      type="checkbox"
                      checked={shopifyCreds.useCorsProxy}
                      onChange={handleShopifyChange}
                      className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="useCorsProxy" className="font-medium text-slate-700">Use CORS Proxy</label>
                    <p className="text-slate-500">Enable for local development if you encounter connection issues.</p>
                  </div>
                </div>
            </div>
          </div>
        
        <div className="text-center pt-2">
          <button type="submit" disabled={!isFormValid || isLoading} className="w-full max-w-xs inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
            {isLoading && <SpinnerIcon />}
            {isLoading ? 'Connecting...' : 'Next: Upload Files'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConfigScreen;
