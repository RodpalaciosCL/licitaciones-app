// netlify/functions/processDoc.js

const { google } = require("googleapis");
const PDFParser = require("pdf2json");
const { Configuration, OpenAIApi } = require("openai");

exports.handler = async (event) => {
  try {
    // 1. Obtenemos fileId
    const { fileId } = event.queryStringParameters || {};
    if (!fileId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No se proporcionó fileId" }),
      };
    }

    // 2. Autenticación con Google
    const auth = new google.auth.JWT(
      "licita-personal@licita-448900.iam.gserviceaccount.com",
      null,
      // Pega tu Private Key completa entre comillas invertidas
      `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgk...
-----END PRIVATE KEY-----
`,
      ["https://www.googleapis.com/auth/drive.readonly"]
    );

    // 3. Descarga el PDF como stream
    const drive = google.drive({ version: "v3", auth });
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    // 4. Conviértelo a Buffer
    const pdfBuffer = Buffer.from(response.data);

    // 5. Extrae el texto con pdf2json
    const extractedText = await parsePdfWithPdf2Json(pdfBuffer);

    // 6. Configura OpenAI
    const configuration = new Configuration({
      apiKey: "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",
    });
    const openai = new OpenAIApi(configuration);

    // 7. Pide resumen a GPT
    const gptResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Eres un asistente que resume texto." },
        { role: "user", content: `Por favor, resume lo siguiente:\n\n${extractedText}` },
      ],
    });
    const resumen = gptResponse.data.choices[0].message.content.trim();

    // 8. Retorna JSON
    return {
      statusCode: 200,
      body: JSON.stringify({ mensaje: "Procesado con éxito", resumen }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Helper para pdf2json
function parsePdfWithPdf2Json(pdfBuffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (errData) =>
      reject(errData.parserError)
    );
    pdfParser.on("pdfParser_dataReady", () => {
      // getRawTextContent() devuelve el texto concatenado
      const rawText = pdfParser.getRawTextContent();
      resolve(rawText);
    });

    // Inicia el parse
    pdfParser.parseBuffer(pdfBuffer);
  });
}
