import React, { useEffect, useState, useMemo } from 'react';
import { StockAsset, NewsItem, PortfolioSummary, AISource, PortfolioHistoryItem } from '../types';
import { TrendingUp, TrendingDown, Newspaper, ExternalLink, Plus, Wallet, ArrowRight, RefreshCw, DollarSign, JapaneseYen } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchStockNews } from '../services/geminiService';

interface DashboardProps {
  assets: StockAsset[];
  onOpenAddModal: () => void;
  usdJpyRate: number;
  onRateChange: (rate: number) => void;
  onRefreshMarketData: () => Promise<void>;
  isRefreshing: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  assets, 
  onOpenAddModal, 
  usdJpyRate, 
  onRateChange,
  onRefreshMarketData,
  isRefreshing
}) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);

  // Derived State for Summary
  const summary: PortfolioSummary = assets.reduce((acc, asset) => {
    const currentVal = asset.quantity * asset.currentPrice;
    const costBasis = asset.quantity * asset.avgPrice;
    return {
      totalValue: acc.totalValue + currentVal,
      totalCost: acc.totalCost + costBasis,
      totalGain: acc.totalGain + (currentVal - costBasis),
      gainPercentage: 0 // calculated below
    };
  }, { totalValue: 0, totalCost: 0, totalGain: 0, gainPercentage: 0 });

  summary.gainPercentage = summary.totalCost > 0 ? (summary.totalGain / summary.totalCost) * 100 : 0;

  // Mock History Generation based on current Total Value
  const historyData: PortfolioHistoryItem[] = useMemo(() => {
    if (summary.totalValue === 0) return [];
    
    const data: PortfolioHistoryItem[] = [];
    let currentValue = summary.totalValue;
    
    // Generate 6 months of data points backwards
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthLabel = `${date.getMonth() + 1}月`;
      
      data.unshift({
        date: monthLabel,
        value: currentValue
      });

      const change = (Math.random() * 0.15) - 0.05;
      currentValue = currentValue / (1 + change);
    }
    return data;
  }, [summary.totalValue]);

  useEffect(() => {
    const getNews = async () => {
      if (assets.length > 0) {
        setLoadingNews(true);
        const items = await fetchStockNews(assets.map(a => a.ticker));
        setNews(items);
        setLoadingNews(false);
      }
    };
    getNews();
  }, [assets.length]);

  const formatUSD = (num: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  const formatJPY = (num: number) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(num);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 bg-slate-50">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        
        {/* Header & Portfolio Summary */}
        <header>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                        米国株<span className="text-blue-600">資産管理</span>
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm sm:text-base">AI駆動型ポートフォリオ・トラッキング</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                    
                     {/* Market Refresh Button */}
                    <button
                        onClick={onRefreshMarketData}
                        disabled={isRefreshing}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm border ${
                            isRefreshing 
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200'
                        }`}
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span className="whitespace-nowrap">
                            {isRefreshing ? '市場データ取得中...' : '市場データを更新'}
                        </span>
                    </button>

                    {/* USD/JPY Rate Input */}
                    <div className="bg-white border border-slate-200 rounded-xl p-2 px-3 md:px-4 flex items-center gap-2 md:gap-3 shadow-sm flex-1 sm:flex-none justify-center">
                        <div className="flex items-center gap-1 text-slate-500 text-xs md:text-sm font-bold">
                            <DollarSign className="w-3 h-3" /> / <JapaneseYen className="w-3 h-3" />
                        </div>
                        <input 
                            type="number" 
                            value={usdJpyRate}
                            onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
                            className="w-16 md:w-20 text-right font-bold text-slate-900 bg-transparent focus:outline-none border-b border-transparent focus:border-blue-500 transition-colors text-sm md:text-base"
                            step="0.1"
                        />
                        <span className="text-[10px] md:text-xs text-slate-400 font-medium">JPY</span>
                    </div>

                    <button 
                        onClick={onOpenAddModal}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transform hover:-translate-y-0.5 text-sm sm:text-base whitespace-nowrap justify-center"
                    >
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="inline">銘柄を追加</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {/* Card 1: Total Value */}
                <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Wallet className="w-24 h-24 text-slate-900" />
                    </div>
                    <p className="text-slate-500 font-bold text-xs md:text-sm mb-1">総資産評価額</p>
                    <div className="flex flex-col">
                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{formatUSD(summary.totalValue)}</h2>
                        <p className="text-base sm:text-lg font-bold text-slate-400 mt-1">
                           ≈ {formatJPY(summary.totalValue * usdJpyRate)}
                        </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-md text-xs md:text-sm font-bold flex items-center gap-1 ${summary.totalGain >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {summary.totalGain >= 0 ? <TrendingUp className="w-3 h-3 md:w-4 md:h-4"/> : <TrendingDown className="w-3 h-3 md:w-4 md:h-4"/>}
                            {summary.totalGain >= 0 ? '+' : ''}{summary.gainPercentage.toFixed(2)}%
                        </span>
                        <span className="text-slate-400 text-xs md:text-sm font-medium">全期間リターン (USD)</span>
                    </div>
                </div>

                {/* Card 2: Chart (Asset History) */}
                <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm col-span-1 md:col-span-2 flex flex-col hover:shadow-md transition-shadow">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-500 font-bold text-xs md:text-sm">資産推移 (過去6ヶ月/USD)</h3>
                        <span className="text-[10px] md:text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">シミュレーション</span>
                     </div>
                     <div className="flex-1 min-h-[150px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={historyData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#94a3b8" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    tickMargin={10}
                                />
                                <YAxis 
                                    hide={true} 
                                    domain={['dataMin - 100', 'dataMax + 100']} 
                                />
                                <Tooltip 
                                    cursor={{stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5 5'}}
                                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                                    formatter={(value: number) => [formatUSD(value), '評価額']}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#2563eb" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorValue)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                     </div>
                </div>
            </div>
        </header>

        {/* Stock List */}
        <section>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-slate-400" /> 保有銘柄
            </h3>
            <div className="grid grid-cols-1 gap-3 md:gap-4">
                {assets.map(asset => {
                    const gain = (asset.currentPrice - asset.avgPrice) * asset.quantity;
                    const gainPercent = ((asset.currentPrice - asset.avgPrice) / asset.avgPrice) * 100;
                    
                    return (
                        <div key={asset.id} className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 transition-all group shadow-sm">
                            {/* Left: Icon & Info */}
                            <div className="flex items-center gap-4 w-full sm:flex-1">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner relative">
                                    {asset.iconUrl ? (
                                        <img src={asset.iconUrl} alt={asset.ticker} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-sm font-bold text-slate-500">{asset.ticker}</span>
                                    )}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                        <h4 className="font-bold text-slate-900 text-lg sm:text-xl truncate">{asset.ticker}</h4>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide whitespace-nowrap">
                                            {asset.source}
                                        </span>
                                    </div>
                                    <div className="text-slate-500 text-xs sm:text-sm mt-1 font-medium truncate">
                                        {asset.quantity}株 <span className="text-slate-300 mx-1">|</span> 平均 {formatUSD(asset.avgPrice)}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Financials (Stacked on Mobile) */}
                            <div className="w-full sm:w-auto border-t sm:border-0 border-slate-100 pt-3 sm:pt-0 flex flex-row sm:flex-col justify-between sm:justify-end items-center sm:items-end mt-1 sm:mt-0">
                                <span className="sm:hidden text-xs font-bold text-slate-400">現在評価額</span>
                                
                                <div className="text-right">
                                    <div className="font-black text-slate-900 text-lg sm:text-xl leading-none mb-1">{formatUSD(asset.currentPrice * asset.quantity)}</div>
                                    <div className="text-slate-400 text-xs sm:text-sm font-bold mb-1">
                                        ≈ {formatJPY(asset.currentPrice * asset.quantity * usdJpyRate)}
                                    </div>
                                    <div className={`text-xs sm:text-sm font-bold flex items-center justify-end gap-1 ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {gain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {formatUSD(gain)} ({gainPercent.toFixed(1)}%)
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {assets.length === 0 && (
                    <div className="text-center py-16 bg-white border-dashed border-2 border-slate-200 rounded-xl">
                        <p className="text-slate-400 font-bold mb-2 text-lg">資産がまだありません。</p>
                        <p className="text-slate-500 text-sm">「銘柄を追加」ボタンから手動入力するか、<br/>取引スクショをアップロードしてください。</p>
                    </div>
                )}
            </div>
        </section>

        {/* Google Search Grounding News */}
        <section>
             <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-slate-400" /> 
                関連ニュース (Google Grounding)
            </h3>
            
            {loadingNews && (
                <div className="flex items-center gap-2 text-slate-500 text-sm animate-pulse bg-white p-4 rounded-xl border border-slate-200">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> 市場データを取得中...
                </div>
            )}

            {!loadingNews && news.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {news.map((item, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
                             <h4 className="font-bold text-sm sm:text-base text-blue-700 mb-2 line-clamp-2">{item.headline}</h4>
                             <p className="text-slate-600 text-xs sm:text-sm leading-relaxed line-clamp-3 mb-3">{item.summary}</p>
                             <div className="flex items-center justify-between mt-auto">
                                <span className="text-xs font-medium text-slate-400">{item.source}</span>
                                {item.url && (
                                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-400 font-bold text-xs hover:text-blue-600 transition-colors">
                                        <ExternalLink className="w-3 h-3" /> 読む
                                    </a>
                                )}
                             </div>
                        </div>
                    ))}
                </div>
            )}

            {!loadingNews && news.length === 0 && assets.length > 0 && (
                <div className="text-slate-500 text-sm italic bg-white p-4 rounded-xl border border-slate-200">
                    保有銘柄に関する重要なニュースは見つかりませんでした。
                </div>
            )}
        </section>

      </div>
    </div>
  );
};