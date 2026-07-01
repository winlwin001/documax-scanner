import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let hasLoggedModels = false;

async function listAndLogModels(ai: any) {
  try {
    const response = await ai.models.list();
    console.log("=== [DEVELOPMENT ONLY] Available Gemini Models ===");
    for (const m of response) {
      console.log(`- ${m.name} (Supported: ${m.supportedGenerationMethods?.join(", ")})`);
    }
    console.log("==================================================");
  } catch (err: any) {
    console.error(`Error listing models: ${err.message}`);
  }
}

async function generateContentWithFallback(
  ai: any,
  params: any,
  fallbackModel: string
): Promise<any> {
  try {
    console.log(`Calling primary model: ${params.model}`);
    return await ai.models.generateContent(params);
  } catch (err: any) {
    console.warn(`Primary model ${params.model} failed: ${err.message}. Trying fallback: ${fallbackModel}`);
    const fallbackParams = { ...params, model: fallbackModel };
    return await ai.models.generateContent(fallbackParams);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured on the server." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // List and log models on first request in development
    if (!hasLoggedModels) {
      hasLoggedModels = true;
      listAndLogModels(ai).catch(console.error);
    }

    const { action, payload } = await req.json();

    const primaryModel = "gemini-2.5-flash"; // Modern supported production model
    const fallbackModel = "gemini-2.5-pro";   // High-quality fallback model
    let responseText = "";

    let params: any = {
      model: primaryModel,
      config: payload.generationConfig || {},
    };

    if (action === "translate_text" || action === "chat") {
      params.contents = payload.contents;
    } else if (action === "translate_image" || action === "translate_audio") {
      params.contents = [
        {
          parts: [
            { inlineData: { mimeType: payload.mimeType, data: payload.data } },
            { text: payload.prompt }
          ]
        }
      ];
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported action." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Gemini with primary model and fallback model
    const response = await generateContentWithFallback(ai, params, fallbackModel);
    responseText = response.text || "";

    // Return the response in the same format as before so the frontend doesn't break
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              { text: responseText }
            ]
          }
        }
      ]
    };

    return new Response(
      JSON.stringify(mockResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
