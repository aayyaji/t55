import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface YouTubeSearchResult {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

export const YouTubeService = {
  async searchVideos(query: string): Promise<YouTubeSearchResult[]> {
    try {
      const prompt = `Find 6 popular YouTube videos for the search query: "${query}". 
      Return the results as a JSON array of objects with the following structure:
      { "id": "videoId", "title": "video title", "thumbnail": "thumbnailUrl", "channelTitle": "channel name" }
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
        return JSON.parse(jsonMatch[0]);
      }
      
      return [];
    } catch (error) {
      console.error("Error searching YouTube videos:", error);
      return [];
    }
  },

  async getTrendingVideos(): Promise<YouTubeSearchResult[]> {
    return this.searchVideos("أشهر فيديوهات يوتيوب في العراق اليوم");
  }
};
