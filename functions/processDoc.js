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

    const auth = new google.auth.JWT(
      "licita-personal@licita-448900.iam.gserviceaccount.com",
      null,
      `-----BEGIN PRIVATE KEY-----
