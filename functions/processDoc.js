// netlify/functions/processDoc.js

const { google } = require("googleapis");
const PDFParser = require("pdf2json");
const { Configuration, OpenAIApi } = require("openai");

exports.handler = async (event) => {
  try {
    const { fileId } = event.queryStringParameters || {};
    if (!fileId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No se proporcionó fileId" }),
      };
    }

    // Autenticación con Google
    const auth = new google.auth.JWT(
      "licita-personal@licita-448900.iam.gserviceaccount.com",
      null,
      `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BA...
-----END PRIVATE KEY-----
`,
      ["https://www.googleapis.com/auth/drive.readonly"]
    );

    // Obtenemos el PDF desde Drive
    const drive = google.drive({ version: "v3", auth });
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    // Convertimos el ArrayBuffer a Buffer
    const pdfBuffer = Buffer.from(response.data);

    // Extraemos texto usando pdf2json
    const extractedText = await parsePdfWithPdf2Json(pdfBuffer);

    // Configuramos OpenAI
    const configuration = new Configuration({
      apiKey: "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",
    });
    const openai = new OpenAIApi(configuration);

    // Pedimos resumen a GPT
    const gptResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Eres un asistente que resume texto." },
        { role: "user", content: `Por favor, resume lo siguiente:\n\n${extractedText}` },
      ],
    });

    const resumen = gptResponse.data.choices[0].message.content.trim();

    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: "Procesado con éxito",
        resumen
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Helper para parsear con pdf2json
function parsePdfWithPdf2Json(pdfBuffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on("pdfParser_dataError", (errData) =>
      reject(errData.parserError)
    );
    pdfParser.on("pdfParser_dataReady", () => {
      // getRawTextContent() devuelve el texto extraído
      const rawText = pdfParser.getRawTextContent();
      resolve(rawText);
    });

    pdfParser.parseBuffer(pdfBuffer);
  });
}
