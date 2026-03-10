chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startAutofill") {
    
    // 1. Scrape standard inputs, ignoring hidden or submit buttons
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'));
    
    // Create a dictionary mapping a unique identifier to the actual DOM element
    const elementMap = {};
    const fieldNames = inputs.map((input, index) => {
      // Use name, id, placeholder, or aria-label as the identifier for the AI
      const identifier = input.name || input.id || input.placeholder || input.getAttribute('aria-label') || `field_${index}`;
      elementMap[identifier] = input;
      return identifier;
    });

    const pageText = document.body.innerText.substring(0, 4000); // Limit text to save tokens

    // 2. Ask the background script to process via AI
    chrome.runtime.sendMessage({ 
      action: "askAI", 
      jobDescription: pageText,
      fields: fieldNames 
    }, (response) => {
      
      if (response && response.data) {
        // 3. Fill the forms based on the AI's JSON output
        const aiData = response.data;
        
        for (const [key, value] of Object.entries(aiData)) {
          const inputElement = elementMap[key];
          
          if (inputElement) {
            inputElement.value = value;
            inputElement.style.backgroundColor = '#e8f0fe'; // Highlight autofilled fields in light blue
            
            // Dispatch events to trick React/Angular into recognizing the programmatic input
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      } else if (response && response.error) {
        alert("AutoApply Error: " + response.error);
      }
      sendResponse({ status: "done" });
    });

    return true; 
  }
});