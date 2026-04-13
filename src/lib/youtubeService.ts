import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface YouTubeSearchResult {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

// Simple in-memory cache to speed up repeated searches and trending loads
const searchCache: Record<string, { results: YouTubeSearchResult[], timestamp: number }> = {};
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

export const YouTubeService = {
  async searchVideos(query: string): Promise<YouTubeSearchResult[]> {
    const now = Date.now();
    if (searchCache[query] && (now - searchCache[query].timestamp) < CACHE_DURATION) {
      return searchCache[query].results;
    }

    try {
      const prompt = `Find 8 popular and high-quality YouTube videos for the search query: "${query}". 
      CRITICAL: Only return videos that are likely to allow embedding (no music videos from VEVO or restricted content if possible).
      Return the results as a JSON array of objects with the following structure:
      { "id": "videoId", "title": "video title", "thumbnail": "highResThumbnailUrl", "channelTitle": "channel name" }
      Only return the JSON array, nothing else. Do not include markdown formatting.`;

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }] as any
        }
      });

      let text = response.text || "";
      
      // Clean up markdown if present
      text = text.replace(/```json|```/g, "").trim();
      
      const jsonMatch = text.match(/\[.*\]/s);
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);
        // Cache the results
        searchCache[query] = { results, timestamp: now };
        return results;
      }
      
      return [];
    } catch (error) {
      console.error("Error searching YouTube videos:", error);
      return [];
    }
  },

  async getTrendingVideos(): Promise<YouTubeSearchResult[]> {
    // Specific query for Iraq trending to get more relevant results
    return this.searchVideos("أشهر فيديوهات يوتيوب في العراق اليوم 2024");
  }
};
