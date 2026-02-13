import './globals.css';

export const metadata = {
  title: 'FlowAI Hub',
  description: 'Turn Zoom conversations into actionable Slack tasks with FlowAI Hub.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-black text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}

