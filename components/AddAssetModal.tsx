import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { StockAsset, AISource } from '../types';
import { parseTradeScreenshot, generateStockIcon } from '../services/geminiService';

interface AddAssetModalProps {
  onClose: () => void;
  onAdd: (asset: StockAsset) => void;
}

export const AddAssetModal: React.FC<AddAssetModalProps> = ({ onClose, onAdd }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'image'>('manual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  
  // Form State
  const [ticker, setTicker] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [source, setSource] = useState<AISource>(AISource.GEMINI);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setLoadingStatus('Gemini Visionがレシートを解析中...');

    try {
      // Convert to Base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        // Strip prefix for API
        const base64Data = base64String.split(',')[1]; 
        const mimeType = file.type;

        const data = await parseTradeScreenshot(base64Data, mimeType);
        
        if (data) {
            if (data.ticker) setTicker(data.ticker);
            if (data.quantity) setQty(data.quantity.toString());
            if (data.avgPrice) setPrice(data.avgPrice.toString());
            setActiveTab('manual'); // Switch to review
            setLoadingStatus('データを抽出しました！内容を確認してください。');
        }
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setLoadingStatus('画像の解析に失敗しました。');
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setLoadingStatus('Nano Bananaでアイコンを生成中...');

    try {
      // Generate Icon
      const iconUrl = await generateStockIcon(ticker);
      
      const newAsset: StockAsset = {
        id: Date.now().toString(),
        ticker: ticker.toUpperCase(),
        companyName: ticker.toUpperCase(), // Ideally fetch this, but okay for now
        quantity: parseFloat(qty),
        avgPrice: parseFloat(price),
        currentPrice: parseFloat(price) * (1 + (Math.random() * 0.1 - 0.05)), // Mock current price +/- 5%
        source: source,
        iconUrl: iconUrl,
        lastUpdated: Date.now()
      };

      onAdd(newAsset);
      onClose();
    } catch (err) {
        console.error(err);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" /> 銘柄の追加
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'manual' ? 'bg-white text-blue-600 shadow ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
            >
              手動入力
            </button>
            <button 
              onClick={() => setActiveTab('image')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'image' ? 'bg-white text-blue-600 shadow ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
            >
              スクショ解析
            </button>
          </div>

          {isProcessing && (
             <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3 text-blue-700 text-sm animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                {loadingStatus}
             </div>
          )}

          {activeTab === 'image' ? (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-500 hover:bg-slate-50 transition-colors cursor-pointer relative group">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-3 pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-slate-900 font-medium">クリックして画像をアップロード</p>
                        <p className="text-slate-500 text-sm mt-1">PNG, JPG, WEBP 対応</p>
                    </div>
                </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ティッカーシンボル (例: AAPL)</label>
                <input 
                  required
                  type="text" 
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  placeholder="AAPL, MSFT..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">数量</label>
                    <input 
                      required
                      type="number" 
                      step="any"
                      value={qty}
                      onChange={e => setQty(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">平均取得単価 ($)</label>
                    <input 
                      required
                      type="number" 
                      step="any"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
                    />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">選定AIソース</label>
                <div className="relative">
                  <select 
                      value={source}
                      onChange={(e) => setSource(e.target.value as AISource)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none appearance-none transition-colors"
                  >
                      {Object.values(AISource).map(s => (
                          <option key={s} value={s}>{s}</option>
                      ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg mt-2 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-600/20"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : '資産に追加'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};