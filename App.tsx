import React from 'react';
import { AuditStatus, Discrepancy } from './types';
import { useAudit } from './hooks/useAudit';
import { exportAuditReportToCsv } from './utils/csvHelper';
import ConfigScreen from './components/ConfigScreen';
import AuditProgressScreen from './components/AuditProgressScreen';
import ReportScreen from './components/ReportScreen';
import FileUploadScreen from './components/FileUploadScreen';
import { ShopifyIcon } from './components/icons';

const AUDIT_STEPS = [
  'Parsing source files',
  'Requesting data from Shopify',
  'Downloading Shopify data',
  'Analyzing datasets',
  'Generating final report',
];

const ALL_ISSUE_TYPES: Discrepancy['Field'][] = ['Price', 'Duplicate SKU', 'H1 in Description', 'Compare Price Issue', 'Missing Clearance Tag', 'Unexpected Clearance Tag'];

const App: React.FC = () => {
  const {
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
  } = useAudit();

  const handleExportCsv = () => {
    if (auditResult) {
      exportAuditReportToCsv(auditResult);
    }
  };

  const PageLayout: React.FC<{children: React.ReactNode}> = ({ children }) => (
    <div className="min-h-screen bg-slate-100">
       <header className="bg-white shadow-sm">
           <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center">
               <ShopifyIcon />
               <h1 className="ml-3 text-xl font-semibold text-slate-800">Shopify Product Auditor</h1>
           </div>
       </header>
       <main>
           {children}
       </main>
   </div>
 );

 const renderContent = () => {
  switch (auditStatus) {
    case AuditStatus.InProgress:
      return <AuditProgressScreen steps={AUDIT_STEPS} currentStep={currentStep} progressMessage={progressMessage} />;
    case AuditStatus.FileUpload:
      return <FileUploadScreen onRunAudit={runAudit} onBack={handleNewAudit} />;
    case AuditStatus.Success:
      const availableIssueTypes = isPartialAudit 
          ? ALL_ISSUE_TYPES.filter(t => t !== 'Unexpected Clearance Tag')
          : ALL_ISSUE_TYPES;
      return auditResult && <ReportScreen result={auditResult} onNewAudit={handleNewAudit} onCreateProductGroup={handleCreateProductGroup} onFixProduct={handleFixProduct} onExportCsv={handleExportCsv} onRemoveItem={handleRemoveItemFromReport} onBulkRemoveItems={handleBulkRemoveItemsFromReport} allIssueTypes={availableIssueTypes} onUpdateVariantImages={handleUpdateVariantImages} onDeleteProductImages={handleDeleteProductImages} onUpdateImageAltTexts={handleUpdateImageAltTexts} activeTab={activeTab} setActiveTab={setActiveTab} isPartialAudit={isPartialAudit} sourceFileNames={sourceFileNames} />;
    case AuditStatus.Error:
       return (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] text-center p-4">
              <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
                  <h2 className="text-2xl font-semibold text-rose-600">An Error Occurred</h2>
                  <p className="mt-2 text-slate-600">{errorMessage}</p>
                  <button 
                      onClick={handleNewAudit}
                      className="mt-6 w-full inline-flex justify-center py-2 px-4 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                  >
                      Start Over
                  </button>
              </div>
          </div>
       );
    case AuditStatus.Idle:
    default:
      return <ConfigScreen onConfigSubmit={handleConfigSubmit} isLoading={isConfigLoading} />;
  }
};

 return <PageLayout>{renderContent()}</PageLayout>;
};

export default App;