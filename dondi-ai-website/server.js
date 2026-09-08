const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 8000);
const apiKey = process.env.GEMINI_API_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || "Dondi AI <onboarding@resend.dev>";
const root = __dirname;
const verificationCodes = new Map();

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        reject(new Error("Request too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function validEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendVerificationEmail(email, code) {
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured on the server.");
  }

  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [email],
      subject: "Your Dondi AI verification code",
      text: `Your Dondi AI verification code is ${code}. It expires in 10 minutes.`
    })
  });

  if (!result.ok) {
    const data = await result.json().catch(() => ({}));
    throw new Error(data.message || "Verification email could not be sent.");
  }
}

async function requestRegistrationCode(request, response) {
  try {
    const payload = await readJson(request);
    const email = String(payload.email || "").trim().toLowerCase();
    if (!validEmail(email)) {
      sendJson(response, 400, { error: "Enter a valid Gmail address." });
      return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    verificationCodes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
    await sendVerificationEmail(email, code);
    sendJson(response, 200, { message: "Verification code sent." });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}

async function verifyRegistrationCode(request, response) {
  try {
    const payload = await readJson(request);
    const email = String(payload.email || "").trim().toLowerCase();
    const code = String(payload.code || "").trim();
    const record = verificationCodes.get(email);

    if (!record || record.expiresAt < Date.now() || record.code !== code) {
      sendJson(response, 400, { error: "Invalid or expired verification code." });
      return;
    }

    verificationCodes.delete(email);
    sendJson(response, 200, { message: "Email verified. Your Dondi AI account is ready." });
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
}

function serveFile(request, response) {
  const requested = request.url === "/" ? "/index.html" : request.url;
  const filePath = path.join(root, decodeURIComponent(requested.split("?")[0]));

  if (!filePath.startsWith(root)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(response, 404, { error: "File not found" });
      return;
    }

    const extension = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8"
    };
    response.writeHead(200, { "Content-Type": types[extension] || "application/octet-stream" });
    response.end(data);
  });
}

async function handleChat(request, response) {
  if (!apiKey) {
    sendJson(response, 500, { error: "GEMINI_API_KEY is not configured on the server." });
    return;
  }

  try {
      const payload = await readJson(request);
      const contents = Array.isArray(payload.messages) ? payload.messages : [];
      const result = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: "You are Dondi AI. Answer clearly, helpfully, and safely. Keep answers concise unless the user asks for detail." }]
            },
            contents: contents.map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: String(message.content || "") }]
            }))
          })
        }
      );

      const data = await result.json();
      if (!result.ok) {
        sendJson(response, result.status, { error: data.error?.message || "Gemini request failed." });
        return;
      }

      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!answer) {
        sendJson(response, 502, { error: "Gemini returned no answer." });
        return;
      }

      sendJson(response, 200, { answer });
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/chat") {
    handleChat(request, response);
    return;
  }
  if (request.method === "POST" && request.url === "/api/register/request-code") {
    requestRegistrationCode(request, response);
    return;
  }
  if (request.method === "POST" && request.url === "/api/register/verify-code") {
    verifyRegistrationCode(request, response);
    return;
  }

  if (request.method === "GET") {
    serveFile(request, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
});

server.listen(port, () => {
  console.log(`Dondi AI running at http://localhost:${port}`);
});
