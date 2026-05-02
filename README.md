# 🌸 Digital Bloom Garden

A real-time hand gesture flower garden that uses your webcam and AI to grow 
and bloom flowers with your hands — no touch required.

![Demo Banner](./banner.png)

## ✨ How It Works

- 📷 Your webcam feed becomes the background
- 🤚 **Left hand** controls stem **growth** — spread your fingers to grow
- 🌸 **Right hand** controls petal **bloom** — open your hand to bloom
- Built with MediaPipe Hands + Gemini AI + React + TypeScript

## 🚀 Live Demo

👉 https://vercel.com/chaditi-webs-projects/digital-bloom-garden/255pteGnQ8GizbubbJ2tu5Hno3Y6

## 🛠️ Tech Stack

- React + TypeScript + Vite
- MediaPipe Hands (hand landmark detection)
- Google Gemini API (via AI Studio)
- HTML5 Canvas (flower rendering)

## 💻 Run Locally

**Prerequisites:** Node.js

1. Clone the repo
```bash
   git clone https://github.com/chaditi-web/Digital-Bloom-Garden-.git
   cd Digital-Bloom-Garden-
```

2. Install dependencies
```bash
   npm install
```

3. Add your Gemini API key — create a `.env.local` file: AIzaSyDsKca3S5e-KVr0hzBoAdkEtc81nFYFluM
4. Run the app
```bash
   npm run dev
```

5. Open `http://localhost:5173` in Chrome → allow camera → show your hands 🌸

## 📸 Screenshots

| Closed Bud | Mid Bloom | Full Bloom |
|---|---|---|
| ![bud](./screenshots/bud.png) | ![mid](./screenshots/mid.png) | ![full](./screenshots/full.png) |

## 🙋‍♀️ Made By

**Aditi** — [GitHub](https://github.com/chaditi-web)

Built during gap year using Google AI Studio + Gemini 2.5 Pro.
