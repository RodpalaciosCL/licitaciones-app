// netlify/functions/processDoc.js

const fetch = require("node-fetch");
const pdfParse = require("pdf-parse");
const { Configuration, OpenAIApi } = require("openai");

exports.handler = async (event) => {
  try {
    // Tomamos directUrl de la querystring
    const { directUrl } = event.queryStringParameters || {};
    if (!directUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No se proporcionó directUrl" }),
      };
    }

    // Descargamos el PDF usando node-fetch
    const pdfResponse = await fetch(directUrl);
    if (!pdfResponse.ok) {
      throw new Error(
        `No se pudo descargar el PDF: ${pdfResponse.status} ${pdfResponse.statusText}`
      );
    }
    const pdfBuffer = await pdfResponse.buffer();

    // Extraemos texto con pdf-parse
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    // Configuramos OpenAI
    const configuration = new Configuration({
      apiKey: "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"
    });
    const openai = new OpenAIApi(configuration);

    // Pedimos resumen a GPT
    const gptResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Eres un asistente que resume texto." },
        {
          role: "user",
          content: `Por favor, resume lo siguiente:\n\n${extractedText}`,
        },
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
