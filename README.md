# 🧪 Mindful Scholar: Premium Flashcard Trainer

A sophisticated, industrial-inspired flashcard trainer designed for deep focus and efficient learning. Built with **React 19**, **Vite**, and **Framer Motion 12**, it features a tactile card-stack interface, gamified SRS (Spaced Repetition System) feedback, and seamless **Notion** integration.

## 🚀 Features

- **Industrial Aesthetics**: Sleek dark mode with glassmorphism and rigid visual hierarchy.
- **Fluid Physics**: Natural card-stack animations and direct-path transitions.
- **SRS Feedback**: Interactive evaluation buttons with visual success effects.
- **Notion Sync**: Real-time persistence of study progress to your Notion Database.

## 🛠️ Installation

```bash
git clone https://github.com/dvrgames1234jjnt2-code/Estudos.git
cd Estudos
npm install
```

## 🔐 Environment Setup

Create a `.env` file in the root directory:

```env
VITE_NOTION_TOKEN=your_notion_internal_integration_secret
```

## 📦 Deployment (Vercel)

1. **Import the repository** into Vercel.
2. **Environment Variables**: Add `VITE_NOTION_TOKEN` with your Notion secret.
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`

> [!NOTE]
> The project includes a `vercel.json` to handle the API proxy, ensuring the Notion integration works perfectly in the production environment.

## 💻 Tech Stack

- **Framework**: React 19 (Vite)
- **Animation**: Framer Motion 12
- **Icons**: Lucide React
- **Integration**: Notion API (via Proxy)
