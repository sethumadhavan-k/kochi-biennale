# Kochi-Muziris Biennale Events Viewer

A modern, responsive web application to browse and filter events from the Kochi-Muziris Biennale. Built with Vite, Tailwind CSS, and vanilla JavaScript.

## Features

- 📅 **Event Listing**: View all events in a clean, organized list view
- 🔍 **Advanced Filtering**: Filter by event type, venue, category, date range, and search
- 📱 **Mobile Responsive**: Fully optimized for mobile devices with compact view
- 🎨 **Modern UI**: Beautiful, clean interface built with Tailwind CSS
- ⚡ **Fast Performance**: Powered by Vite for lightning-fast development and builds
- 🔄 **Real-time Updates**: Events are sorted and filtered in real-time

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The production build will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
biennale-event/
├── index.html          # Main HTML file
├── src/
│   ├── main.js        # Main JavaScript application logic
│   └── style.css      # Tailwind CSS and custom styles
├── package.json       # Project dependencies and scripts
├── vite.config.js     # Vite configuration
├── tailwind.config.js # Tailwind CSS configuration
└── postcss.config.js  # PostCSS configuration
```

## Technologies Used

- **Vite**: Next-generation frontend build tool
- **Tailwind CSS**: Utility-first CSS framework
- **Vanilla JavaScript**: No framework dependencies

## API

The application fetches events from the Kochi-Muziris Biennale API using a CORS proxy.

## License

MIT

