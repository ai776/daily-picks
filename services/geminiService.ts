import { GoogleGenAI, Modality, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { StockAsset, NewsItem } from "../types";

// Initialize Gemini Client
// NOTE: In a real production app, API keys should be handled via a backend proxy.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 1. Nano Banana: Generate Icon for Stock
 * Uses 'gemini-2.5-flash-image'
 */
export const generateStockIcon = async (ticker: string): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Create a high-quality, modern, minimalist 3D circular app icon for the US stock ticker "${ticker}". 
                   The design should represent the company's industry or branding colors. 
                   Keep it clean and distinguishable. White background.`
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part && part.inlineData) {
      const base64ImageBytes = part.inlineData.data;
      return `data:image/png;base64,${base64ImageBytes}`;
    }
    return undefined;
  } catch (error) {
    console.error("Error generating icon:", error);
    return undefined;
  }
};

/**
 * 2. Vision: Analyze Trade Receipt
 * Uses 'gemini-3-pro-preview' for complex document reasoning
 */
export const parseTradeScreenshot = async (base64Image: string, mimeType: string): Promise<Partial<StockAsset> | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: `Analyze this image. It is a screenshot of a stock purchase or trade confirmation.
                   Extract the Ticker Symbol (e.g., AAPL, TSLA), the Quantity of shares purchased, and the Price per share.
                   If the company name is visible, extract that too.
                   Return JSON only.`
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ticker: { type: Type.STRING },
            companyName: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            avgPrice: { type: Type.NUMBER },
          },
          required: ["ticker", "quantity", "avgPrice"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Error parsing receipt:", error);
    throw error;
  }
};

/**
 * 3. Search Grounding: Get News
 * Uses 'gemini-2.5-flash' with googleSearch tool
 */
export const fetchStockNews = async (tickers: string[]): Promise<NewsItem[]> => {
  if (tickers.length === 0) return [];
  
  try {
    const tickerString = tickers.join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Find the latest significant financial news for these US stocks: ${tickerString}. 
                 Identify the top 10 distinct news stories.
                 Output the result strictly in this format for each story: "HEADLINE :: SUMMARY"
                 Separate each story with "|||".
                 Do not add numbering, bullet points, or markdown formatting.
                 Write in Japanese.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // Parse the structured text
    const rawItems = text.split('|||').map(s => s.trim()).filter(s => s.length > 0);

    const newsItems: NewsItem[] = rawItems.map((raw, index) => {
        const parts = raw.split('::');
        const headline = parts[0]?.trim() || "関連ニュース";
        const summary = parts[1]?.trim() || raw;
        
        // Attempt to assign a relevant source from grounding chunks if available.
        // This is an approximation since chunks aren't 1:1 mapped to text generation segments easily.
        const chunk = groundingChunks[index % groundingChunks.length];
        const url = chunk?.web?.uri; 
        const source = chunk?.web?.title || "Google Search";

        return {
            headline,
            summary,
            url,
            source
        };
    });
    
    // Fallback if parsing fails or returns nothing
    if (newsItems.length === 0 && text.length > 0) {
        return [{
            headline: "市場ニュース",
            summary: text,
            source: "Google Search",
            url: groundingChunks[0]?.web?.uri
        }];
    }

    return newsItems;
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
};

/**
 * 4. Search Grounding: Update Market Prices
 * Uses 'gemini-2.5-flash' with googleSearch tool to get real-time-ish data
 */
export const updateMarketPrices = async (tickers: string[]): Promise<{ prices?: Record<string, number>, usdJpy: number } | null> => {
  try {
    let prompt = "";
    // Define the expected JSON structure instructions
    const jsonInstruction = `
      Return the result strictly as a valid JSON object without markdown code blocks (no \`\`\`json).
      The JSON structure must be:
      {
        "prices": { "TICKER_SYMBOL": PRICE_NUMBER, ... },
        "usdJpy": EXCHANGE_RATE_NUMBER
      }
      If no stock prices are requested or found, return an empty object for "prices".
    `;

    if (tickers.length > 0) {
        const tickerString = tickers.join(", ");
        prompt = `
          Find the latest market price (real-time or delayed by 15min) for the following US stock tickers: ${tickerString}.
          Also find the current real-time USD to JPY exchange rate.
          ${jsonInstruction}
        `;
    } else {
        prompt = `
          Find the current real-time USD to JPY exchange rate.
          ${jsonInstruction}
        `;
    }

    // NOTE: Do NOT use responseSchema or responseMimeType when using googleSearch tool.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let text = response.text || "";
    
    // Clean up potential markdown formatting
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    if (text) {
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON from market update:", text);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error("Error updating prices:", error);
    return null;
  }
};


/**
 * 5. Chat Analysis
 * Uses 'gemini-2.5-flash' for speed and general reasoning
 */
export const streamPortfolioChat = async function* (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  portfolioContext: string,
  usdJpyRate: number
) {
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `あなたはシニア金融アナリストのアシスタントです。
      ユーザーは米国株のポートフォリオを持っています。
      現在のポートフォリオのJSONデータはこちらです: ${portfolioContext}.
      
      現在のUSD/JPY為替レートは 1ドル = ${usdJpyRate}円 です。
      資産価値や利益を計算する際は、必要に応じてこのレートを使用して日本円換算の数値も提示してください。
      
      彼らの保有資産について質問に答えたり、利益を計算したり、分析を提供してください。
      現在の市場価格について聞かれた場合は、JSONにあるモック価格を現在の価格として扱うか、
      あるいはリアルタイムの株価データは持っていないが、提供されたスナップショットに基づいて分析できると説明してください。
      
      回答は常に日本語で行ってください。簡潔かつ専門的に振る舞ってください。`
    },
    history: history,
  });

  const result = await chat.sendMessageStream({ message });
  
  for await (const chunk of result) {
    yield chunk.text;
  }
};