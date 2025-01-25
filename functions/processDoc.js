// netlify/functions/processDoc.js

const { google } = require("googleapis");
const pdfParse = require("pdf-parse");
const { Configuration, OpenAIApi } = require("openai");

exports.handler = async (event) => {
  try {
    // 1. Tomamos el fileId de la query
    const { fileId } = event.queryStringParameters || {};
    if (!fileId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No se proporcionó fileId" }),
      };
    }

    // 2. Autenticación con Google (tu service account)
    const auth = new google.auth.JWT(
      "licita-personal@licita-448900.iam.gserviceaccount.com",
      null,
      // Tu clave privada completa, con BEGIN/END, y reemplazando \n si hace falta
      `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BA...
-----END PRIVATE KEY-----
`,
      ["https://www.googleapis.com/auth/drive.readonly"]
    );

    // 3. Descargamos el archivo desde Drive
    const drive = google.drive({ version: "v3", auth });
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    // 4. Convertimos el stream a buffer
    const pdfBuffer = await streamToBuffer(response.data);

    // 5. Extraemos texto del PDF usando pdf-parse (no más rutas locales)
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    // 6. Configuramos OpenAI
    const configuration = new Configuration({
      apiKey: "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",
    });
    const openai = new OpenAIApi(configuration);

    // 7. Pedimos a GPT el resumen
    const gptResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Eres un asistente que resume texto." },
        { role: "user", content: `Por favor, resume lo siguiente:\n\n${extractedText}` },
      ],
    });
    const resumen = gptResponse.data.choices[0].message.content.trim();

    // 8. Enviamos JSON con el resultado
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: "Procesado con éxito",
        resumen
      })
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
