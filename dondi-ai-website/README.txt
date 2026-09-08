Dondi AI - Real Gemini Chat

1. Install Node.js 18 or newer.
2. Copy .env.example to .env.
3. Put your Gemini API key in .env.
4. Create a Resend account and put its API key in RESEND_API_KEY. Verify your sending domain for production email.
5. Set the environment variables in PowerShell:
   $env:GEMINI_API_KEY="your-key-here"
   $env:RESEND_API_KEY="your-resend-key"
6. Start the app:
   node server.js
7. Open http://localhost:8000

No login or registration is required. Visitors can open the chat and send messages immediately.

Never put the Gemini API key inside index.html or script.js.
