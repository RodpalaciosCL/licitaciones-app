// netlify/functions/processDoc.js

const { google } = require("googleapis");
const pdfParse = require("pdf-parse");
const { Configuration, OpenAIApi } = require("openai");

exports.handler = async (event) => {
  try {
    // Tomamos fileId de la query
    const { fileId } = event.queryStringParameters || {};
    if (!fileId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No se proporcionó fileId" }),
      };
    }

    // Autenticación con Google (tus credenciales exactas)
    const auth = new google.auth.JWT(
      "licita-personal@licita-448900.iam.gserviceaccount.com",
      null,
      `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDO7dQYH+kVJAiS
/wzHbkizKdfi+qMpzUFrBhFNnvSUnf6nBDrt64HunHIkF/TYSHczsCDouyYH360R
WfyQtIk1K12h5Z74RySfOy+1y0yBautNQHeR8bmZ0wy7nKvYUpbEkxEPjYWwOp4E
T3Xflv0sJZMTgqvAXx8+ZjtMcubN7cVpUpzQIRn+Vgd/TCVM5JYjyIobFBpPlp9D
jwKX3wmNkSBWzVOtv6CKHall3apIhxVKfqAfjL6xoN/0CgVt+0SXmA6zNun0b59e
EnVoKqYL7KeSDPVlfGkPKTGkTWoitwlHx//ektc6xnk2geCyYm5QgtiFPc8DWNEd
9qprAug1AgMBAAECggEALcpuSUpic1WuegzroIQ0nUUQq39INPthUxQcJx+aQvr1
e7MRcU3QymMfVQJiIaxjiHIczjN/1nU2YKUXoVP6GuR2S1m7RHjFz2CzDZkn3Gmz
GTy/WPHzXulXo3qngm7AQ07CEz1/jIBkMFL/JBPPAYJtGf+sDx1dlhrcW23/yijC
RE+l+h1Z3WHAkby8+O0T7IQvgR4lnUQGLDPSBtnnTW+PXv6xhcpp5rX8WQryqc9B
wSr/9YAWNibVWCnvTU0Onb4Jz/njxLkqhUfXEZhncnh3fRkNWjvieDWCy3q4WnO3
UiqUIdZ2XHicSO/0K9tcLmTydXAVQ0WgHeLGGBBKgQKBgQDsdaUX+E3yZVrSlsFk
/56ploZ8pl2+5RHCK/KEaF/6aLFF9M1eV24DrdNO8jn8ZjBwUwncORm6vjoqJ+Fn
ToFjrqdvQaTsMsj0/VburaJyZ91tupQRu9EdKfqR4bBcXIj1/sI8cWfahHM978n5
1NwlZe2gn82axc/zlM1e9vX3QQKBgQDgB3VhS72Vii2K5qFQ02SkMa1Fbyz77/Cv
FjeHCzszoAAdoKwuWFLNBatFdDm6PrIgG/TLPBHzkwCMa8OoK/Mmb7YR2wwIoxHj
m2ScH8j+PI7H7Csq+OoHTmXiTNIQ7AijoPeZ4jVsxON9MoChjr4XY4hzGn/2wHHd
2nOH97qH9QKBgQCBO4LxaMnhErfipHYqJvKmKRhzg9F0hWmBP9eZuhnKl/FbFIIx
b4M3C4eTfBto8MjEev3GmIaRY2oSpB0zAtsAifIEglIKrW7bRqJ+a/N+p3mDgRdv
4cBWOh0yIbDrqb9JAuVRd4GVEhKR5T30BvwSjHSk9vG+ByKyM79SiZLAgQKBgQDT
olgh1OJBHWrOl/b2muytK/yq5k7RpaZyUIOeQF7p8xGI65scoPV/lwZoM1bBea7e
JGrJf3LZ7hoLjVYlTXeC7O9LyOmCU0J4CPkvf9tpSR39AT76dnDm/AnFkZq0v7Wd
llexeH/Nw+XABPB9LpKnF7D0Q6l1GfG3ikGvxbfh7QKBgGjBqv9NX4oZ+a9MyP3I
H566dgifUGFTaQKuQJy5mq7kfI2DfgEg2ingXczdGng6d3DAcnXpaxmrStb2i8QA
j+BtawbGWUy0hbOykbWpih/4vafeBt1ausTcFQO57nmquUPxvLNJxdAsrrSTlFE7
N8s7oaeoWPGcC+SESqCLDdgI
-----END PRIVATE KEY-----
`,
      ["https://www.googleapis.com/auth/drive.readonly"]
    );

    // Descargamos el PDF como stream
    const drive = google.drive({ version: "v3", auth });
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    // Convertimos stream a Buffer
    const pdfBuffer = await streamToBuffer(response.data);

    // Parseamos el PDF para extraer texto
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    // OpenAI con tu API Key
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
