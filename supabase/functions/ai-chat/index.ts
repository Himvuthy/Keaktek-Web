import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Access denied." }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Access denied." }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not configured" }), { 
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { prompt, mode = "general", messages = [] } = await req.json();

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: "A prompt is required" }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const modeInstructions: Record<string, string> = {
      general: "Act as a friendly and encouraging school tutor.",
      math: "Act as a math tutor. Explain every step without skipping reasoning.",
      explain: "Explain the topic clearly using simple language and examples.",
    };

    const history = messages
      .slice(-10)
      .map((message: any) => {
        const speaker = message.role === "assistant" ? "Tutor" : "Student";
        return `${speaker}: ${message.content}`;
      })
      .join("\n");

    const input = `
${modeInstructions[mode] || modeInstructions.general}

Keep answers safe and appropriate for a school student.
Do not simply provide answers when teaching a problem; explain the process.

Previous conversation:
${history || "No previous messages"}

Student:
${prompt}
`.trim();

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: input,
    });

    const answer = response.text;

    if (!answer) {
      return new Response(JSON.stringify({ error: "Gemini returned an empty response" }), { 
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ success: true, answer, mode }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("AI chat error:", error.message);
    return new Response(JSON.stringify({ error: "The AI tutor could not answer right now" }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
