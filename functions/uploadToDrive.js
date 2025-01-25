// netlify/functions/uploadFile.js
// Esta función recibe un PDF (multipart/form-data) y lo sube a Google Drive.
// Devuelve fileId del archivo subido.

const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    // 1. Parsear el body. Como es multipart/form-data, puede que uses un paquete como 'busboy'.
    //   - En tu repo actual, veo que usas "busboy" en el handler. Así que conserva esa lógica.

    // NOTA IMPORTANTE:
    // A continuación muestro un EJEMPLO simplificado que lee el archivo
    // desde un "Body" en base64 (por ejemplo). Si tú ya tienes tu propia lógica con "busboy",
    // reemplaza la parte de "leerArchivoBase64" por tu implementación actual.
    
    const body = JSON.parse(event.body || '{}'); 
    // Asumiendo que estás mandando el PDF en base64 
    // en un campo "fileBase64". Ajusta a tu realidad:

    const fileBase64 = body.fileBase64;
    if (!fileBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No file data provided' })
      };
    }

    // Convertir base64 a buffer
    const fileBuffer = Buffer.from(fileBase64, 'base64');

    // 2. Autenticarnos con Google Drive
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // 3. Subir el archivo a Drive
    // Opcionalmente, puedes poner 'parents: ["FOLDER_ID_AQUÍ"]' si deseas subirlo a una carpeta específica
    const res = await drive.files.create({
      requestBody: {
        name: `Documento-${uuidv4()}.pdf`,
        mimeType: 'application/pdf',
        // parents: ["TU_FOLDER_ID_SI_PROCEDE"]
      },
      media: {
        mimeType: 'application/pdf',
        body: Buffer.from(fileBuffer)
      }
    });

    const fileId = res.data.id;

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        fileId
      })
    };
  } catch (error) {
    console.error('Error en uploadFile:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
