import "./globals.css";

export const metadata = {
  title: "Rakhaav — Smart Inventory & GST Billing",
  description: "Complete inventory management, GST billing, and business accounting for Indian shopkeepers.",
  keywords: "inventory management, GST billing, udhaar, vyapar, shop management",
  themeColor: "#0f172a",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
