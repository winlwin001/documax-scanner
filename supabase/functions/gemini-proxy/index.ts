const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let hasLoggedModels = false;

async function listAndLogModels(apiKey: string) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );
    if (response.ok) {
      const data = await response.json();
      console.log("=== [DEVELOPMENT ONLY] Available Gemini Models ===");
      if (data.models) {
        data.models.forEach((m: any) => {
          console.log(`- ${m.name} (Supported: ${m.supportedGenerationMethods?.join(", ")})`);
        });
      } else {
        console.log("No models returned in list.");
      }
      console.log("==================================================");
    } else {
      console.error(`Failed to list models: ${response.statusText}`);
    }
  } catch (err: any) {
    console.error(`Error listing models: ${err.message}`);
  }
}

async function callGeminiWithFallback(
  primaryModel: string,
  fallbackModel: string,
  apiKey: string,
  requestBody: any
): Promise<Response> {
  const primaryUrl = `https://generativelanguage.googleapis.com/v1/models/${primaryModel}:generateContent?key=${apiKey}`;
  
  console.log(`Attempting Gemini request with primary model: ${primaryModel}`);
  
  let response = await fetch(primaryUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  // If primary model fails with 404 (Not Found), try fallback model
  if (response.status === 404) {
    console.warn(`Primary model ${primaryModel} returned 404. Attempting fallback model: ${fallbackModel}`);
    const fallbackUrl = `https://generativelanguage.googleapis.com/v1/models/${fallbackModel}:generateContent?key=${apiKey}`;
    
    response = await fetch(fallbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      console.log(`Successfully recovered using fallback model: ${fallbackModel}`);
    } else {
      console.error(`Fallback model ${fallbackModel} also failed with status: ${response.status}`);
    }
  }

  return response;
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

    // List and log models on first request in development
    if (!hasLoggedModels) {
      hasLoggedModels = true;
      // Run asynchronously so it doesn't block the user's translation request
      listAndLogModels(GEMINI_API_KEY).catch(console.error);
    }

    const { action, payload } = await req.json();

    let requestBody = {};
    const primaryModel = "gemini-1.5-flash-latest";
    const fallbackModel = "gemini-1.5-pro-latest";

    if (action === "translate_text" || action === "chat") {
      requestBody = {
        contents: payload.contents,
        generationConfig: payload.generationConfig || {},
      };
    } else if (action === "translate_image" || action === "translate_audio") {
      requestBody = {
        contents: [
          {
            parts: [
              { inlineData: { mimeType: payload.mimeType, data: payload.data } },
              { text: payload.prompt }
            ]
          }
        ],
        generationConfig: payload.generationConfig || {},
      };
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported action." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Gemini with primary model and fallback model
    const response = await callGeminiWithFallback(
      primaryModel,
      fallbackModel,
      GEMINI_API_KEY,
      requestBody
    );

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${errText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
