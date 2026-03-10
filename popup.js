document.addEventListener('DOMContentLoaded', () => {
  const aiModelInput = document.getElementById('aiModel');
  const apiKeyInput = document.getElementById('apiKey');
  const resumeUpload = document.getElementById('resumeUpload');
  const autofillBtn = document.getElementById('autofillBtn');
  const uploadStatus = document.getElementById('uploadStatus');
  const statusMsg = document.getElementById('statusMsg');

  // Load saved configurations
  chrome.storage.local.get(['aiModel', 'apiKey'], (data) => {
    if (data.aiModel) aiModelInput.value = data.aiModel;
    if (data.apiKey) apiKeyInput.value = data.apiKey;
  });

  aiModelInput.addEventListener('change', () => chrome.storage.local.set({ aiModel: aiModelInput.value }));
  apiKeyInput.addEventListener('change', () => chrome.storage.local.set({ apiKey: apiKeyInput.value }));

  // Set the worker for PDF.js
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
  }

  // Handle Resume Uploads
  resumeUpload.addEventListener('change', async (event) => {
    const files = event.target.files;
    let resumes = [];
    let filesProcessed = 0;

    const checkCompletion = () => {
      filesProcessed++;
      if (filesProcessed === files.length) {
        chrome.storage.local.set({ resumes: resumes }, () => {
          uploadStatus.classList.remove('hidden');
          setTimeout(() => uploadStatus.classList.add('hidden'), 3000);
        });
      }
    };

    Array.from(files).forEach(file => {
      if (file.type === "application/pdf") {
        // Handle PDF Files
        const reader = new FileReader();
        reader.onload = async function(e) {
          const typedarray = new Uint8Array(e.target.result);
          try {
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => item.str).join(" ");
              fullText += pageText + "\n";
            }
            resumes.push({ name: file.name, content: fullText });
          } catch (error) {
            console.error("Error extracting PDF text:", error);
          }
          checkCompletion();
        };
        reader.readAsArrayBuffer(file);
      } else {
        // Handle standard TXT Files
        const reader = new FileReader();
        reader.onload = (e) => {
          resumes.push({ name: file.name, content: e.target.result });
          checkCompletion();
        };
        reader.readAsText(file);
      }
    });
  });

  // Start Autofill
  autofillBtn.addEventListener('click', async () => {
    statusMsg.innerText = "Analyzing page & generating data...";
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: "startAutofill" }, (response) => {
      if (chrome.runtime.lastError) {
        statusMsg.innerText = "Error: Please refresh the application page.";
      } else {
        statusMsg.innerText = "Autofill complete!";
        setTimeout(() => { statusMsg.innerText = ""; }, 3000);
      }
    });
  });
});