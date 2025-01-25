// netlify/functions/processDoc.js

const { google } = require("googleapis");
const pdfParse = require("pdf-parse");
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
MIIEvgIBADANBgk...
-----END PRIVATE KEY-----
`,
      ["https://www.googleapis.com/auth/drive.readonly"]
    );

    // Descargamos el PDF de Drive como stream
    const drive = google.drive({ version: "v3", auth });
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    // Convertimos stream a Buffer
    const pdfBuffer = await streamToBuffer(response.data);

    // Parseamos con pdf-parse
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    // Configuración OpenAI
    const configuration = new Configuration({
      apiKey: "sk-proj-...", // tu API Key de OpenAI
    });
    const openai = new OpenAIApi(configuration);

    // Resumen con GPT
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
        resumen,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", (err) => reject(err));
  });
}
