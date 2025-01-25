// netlify/functions/processDoc.js

const { google } = require("googleapis");
const pdfExtraction = require("pdf-extraction");
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

    // 1) Autenticación con Google
    const auth = new google.auth.JWT(
      "licita-personal@licita-448900.iam.gserviceaccount.com",
      null,
      `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgk...
-----END PRIVATE KEY-----
`,
      ["https://www.googleapis.com/auth/drive.readonly"]
    );

    const drive = google.drive({ version: "v3", auth });

    // 2) Descargamos el PDF en arraybuffer
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    const pdfBuffer = Buffer.from(response.data);

    // 3) Extraemos texto con pdf-extraction
    //    Esto devuelve un objeto con { text, numpages, info, metadata, ... }
    const data = await pdfExtraction.pdfToText(pdfBuffer, {});
    const extractedText = data.text;

    // 4) Configuramos OpenAI
    const configuration = new Configuration({
      apiKey: "sk-proj-...", // tu clave de OpenAI
    });
    const openai = new OpenAIApi(configuration);

    // 5) Pedimos resumen a GPT
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
