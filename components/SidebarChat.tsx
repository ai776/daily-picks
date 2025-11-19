import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { StockAsset, ChatMessage } from '../types';
import { streamPortfolioChat } from '../services/geminiService';

interface SidebarChatProps {
  assets: StockAsset[];
  usdJpyRate: number;
}

export const SidebarChat: React.FC<SidebarChatProps> = ({ assets, usdJpyRate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "こんにちは！Geminiポートフォリオアシスタントです。保有している米国株について質問するか、購入レシートをアップロードして資産を更新してください。" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const portfolioContext = JSON.stringify(assets.map(a => ({
        ticker: a.ticker,
        qty: a.quantity,
        avg_cost: a.avgPrice,
        current_val: a.currentPrice * a.quantity
      })));

      // Convert current messages to API history format
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const stream = streamPortfolioChat(history, userMsg.text, portfolioContext, usdJpyRate);
      
      let fullResponse = "";
      setMessages(prev => [...prev, { role: 'model', text: '', isThinking: true }]);

      for await (const chunk of stream) {
        fullResponse += chunk;
        setMessages(prev => {
          const newArr = [...prev];
          newArr[newArr.length - 1] = { role: 'model', text: fullResponse, isThinking: false };
          return newArr;
        });
      }

    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "申し訳ありません。リクエストの処理中にエラーが発生しました。" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-full md:w-96 fixed right-0 top-0 bottom-0 shadow-xl z-20">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
        <Bot className="text-blue-600 w-6 h-6" />
        <h2 className="font-bold text-lg text-slate-800">Gemini Analyst</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-slate-50/50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
            }`}>
              {msg.role === 'model' && <Bot className="w-4 h-4 mb-1 text-blue-600 inline-block mr-2" />}
              {msg.isThinking ? (
                <span className="animate-pulse text-slate-500">思考中...</span>
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.text}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="NVIDIAのポジションについて分析して..."
            className="flex-1 bg-slate-100 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white text-slate-900 placeholder-slate-400 transition-colors"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};