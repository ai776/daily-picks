import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { SidebarChat } from './components/SidebarChat';
import { AddAssetModal } from './components/AddAssetModal';
import { StockAsset, AISource } from './types';
import { updateMarketPrices } from './services/geminiService';

// Initial mock data
const MOCK_ASSETS: StockAsset[] = [
  {
    id: 'initial-itub',
    ticker: 'ITUB',
    companyName: 'Itau Unibanco Holding',
    quantity: 1,
    avgPrice: 7.52,
    currentPrice: 7.52,
    source: AISource.GEMINI,
    lastUpdated: Date.now()
  }
];

const App: React.FC = () => {
  const [assets, setAssets] = useState<StockAsset[]>(MOCK_ASSETS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [usdJpyRate, setUsdJpyRate] = useState<number>(154.5);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);

  // Mobile layout state check
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto refresh on mount
  useEffect(() => {
    handleRefreshMarketData();
  }, []);

  const handleAddAsset = (asset: StockAsset) => {
    setAssets(prev => [...prev, asset]);
  };

  const handleRefreshMarketData = async () => {
    setIsRefreshingMarket(true);
    const tickers = assets.map(a => a.ticker);
    
    try {
        const marketData = await updateMarketPrices(tickers);
        
        if (marketData) {
            // Update USD/JPY if available
            if (marketData.usdJpy) {
                setUsdJpyRate(marketData.usdJpy);
            }

            // Update Asset Prices
            if (marketData.prices && assets.length > 0) {
                setAssets(prevAssets => prevAssets.map(asset => {
                    // Type assertion to allow string indexing if needed, though TS usually handles Record<string, number> well.
                    // We iterate to find if price exists for this ticker
                    const newPrice = Object.entries(marketData.prices!).find(
                        ([t, p]) => t.toUpperCase() === asset.ticker.toUpperCase()
                    )?.[1];

                    if (newPrice) {
                        return {
                            ...asset,
                            currentPrice: typeof newPrice === 'number' ? newPrice : asset.currentPrice,
                            lastUpdated: Date.now()
                        };
                    }
                    return asset;
                }));
            }
        }
    } catch (error) {
        console.error("Failed to refresh market data", error);
    } finally {
        setIsRefreshingMarket(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden relative">
      
      {/* Main Dashboard Area */}
      <div className={`flex-1 h-full flex flex-col transition-all duration-300 ${isMobile ? 'w-full' : 'mr-96'}`}>
        <Dashboard 
          assets={assets} 
          onOpenAddModal={() => setIsAddModalOpen(true)}
          usdJpyRate={usdJpyRate}
          onRateChange={setUsdJpyRate}
          onRefreshMarketData={handleRefreshMarketData}
          isRefreshing={isRefreshingMarket}
        />
      </div>

      {/* Right Sidebar - Chat (Hidden on mobile, usually you'd add a toggle, keeping it simple for now or stacked) */}
      {!isMobile && (
        <SidebarChat assets={assets} usdJpyRate={usdJpyRate} />
      )}

      {/* Mobile Chat Toggle or View - For this requirement, we focus on desktop layout primarily per "Right Window" request */}
      
      {/* Modals */}
      {isAddModalOpen && (
        <AddAssetModal 
          onClose={() => setIsAddModalOpen(false)} 
          onAdd={handleAddAsset} 
        />
      )}

    </div>
  );
};

export default App;