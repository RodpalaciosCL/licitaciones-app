// netlify/functions/processDoc.js

const fetch = require("node-fetch");
const pdfParse = require("pdf-parse");
const { Configuration, OpenAIApi } = require("openai");

exports.handler = async (event) => {
  try {
    const { directUrl } = event.queryStringParameters || {};
    if (!directUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No se proporcionó directUrl" }),
      };
    }

    const pdfResponse = await fetch(directUrl);
    if (!pdfResponse.ok) {
      throw new Error(
        `No se pudo descargar el PDF: ${pdfResponse.status} ${pdfResponse.statusText}`
      );
    }

    const pdfBuffer = await pdfResponse.buffer();

    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    const configuration = new Configuration({
      apiKey: "sk-proj-...", 
    });
    const openai = new OpenAIApi(configuration);

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
