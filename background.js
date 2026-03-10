chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "askAI") {
    chrome.storage.local.get(['aiModel', 'apiKey', 'resumes'], async (data) => {
      
      if (!data.apiKey || !data.resumes || data.resumes.length === 0) {
        sendResponse({ error: "Missing API Key or Resumes. Please check the extension popup." });
        return;
      }

      // Format all resumes into a single text block
      const allResumesText = data.resumes.map((r, i) => `Resume ${i + 1} (${r.name}):\n${r.content}`).join('\n\n');

      const systemPrompt = `You are an expert job application assistant. 
      Review the provided job description and my provided resumes. Choose the best fitting resume.
      Then, map my information to the provided form fields. 
      Return ONLY a raw JSON object where the keys are the exact field names provided, and the values are the strings to input. 
      Do not include markdown formatting like \`\`\`json.`;

      const userPrompt = `
      Job Description: ${request.jobDescription}
      
      My Resumes: ${allResumesText}
      
      Form Fields to fill: ${request.fields.join(', ')}
      `;

      try {
        let finalJsonData = {};

        // --- OPENAI ---
        if (data.aiModel === 'openai') {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.apiKey}` },
            body: JSON.stringify({
              model: "gpt-4-turbo",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              temperature: 0.1
            })
          });
          const result = await res.json();
          finalJsonData = JSON.parse(result.choices[0].message.content.trim());
        }

        // --- GEMINI ---
        else if (data.aiModel === 'gemini') {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${data.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }]
            })
          });
          const result = await res.json();
          let textRes = result.candidates[0].content.parts[0].text.trim();
          textRes = textRes.replace(/^```json/, '').replace(/```$/, ''); // Clean markdown if AI ignores instructions
          finalJsonData = JSON.parse(textRes);
        }

        // --- ANTHROPIC ---
        else if (data.aiModel === 'anthropic') {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': data.apiKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerously-allow-browser': 'true' // Required for extensions
            },
            body: JSON.stringify({
              model: "claude-3-opus-20240229",
              max_tokens: 1500,
              system: systemPrompt,
              messages: [{ role: "user", content: userPrompt }]
            })
          });
          const result = await res.json();
          finalJsonData = JSON.parse(result.content[0].text.trim());
        }

        sendResponse({ data: finalJsonData });

      } catch (error) {
        console.error("AI API Error:", error);
        sendResponse({ error: error.message });
      }
    });
    return true; // Keep message channel open for async fetch
  }
});