import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: "DomiCita - Tu WhatsApp se convierte en tu recepcionista para barberías, salones de belleza y unisex en RD",
    template: "%s | DomiCita"
  },
  description: "El chatbot que agenda citas por WhatsApp mientras tú trabajas. Para barberías, salones de belleza y unisex. Entiende jerga dominicana (klk, ta disponible, dale), funciona 24/7 y lo configuras en 5 minutos. 14 días gratis sin tarjeta.",
  keywords: [
    "chatbot whatsapp republica dominicana",
    "bot para barberias",
    "bot para salones de belleza",
    "bot para peluquerias",
    "citas automaticas por whatsapp",
    "recepcionista virtual barberia",
    "recepcionista virtual salon de belleza",
    "agenda citas whatsapp santo domingo",
    "chatbot salones de belleza rd",
    "chatbot peluqueria republica dominicana",
    "software barberia republica dominicana",
    "software salon de belleza republica dominicana",
    "whatsapp bot citas",
    "automatizar barberia",
    "automatizar salon de belleza",
    "sistema de reservas whatsapp",
    "bot citas peluqueria",
    "chatbot dominicano",
    "agendar citas whatsapp",
    "agenda online salon unisex"
  ],
  authors: [{ name: "DomiCita", url: "https://domicitas.do" }],
  creator: "DomiCita",
  publisher: "DomiCita",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_DO",
    url: "https://domicitas.do",
    title: "DomiCita - Tu WhatsApp se convierte en tu recepcionista 24/7",
    description: "El chatbot que agenda citas por WhatsApp mientras tú trabajas. Entiende jerga dominicana y lo configuras en 5 minutos. 14 días gratis sin tarjeta.",
    siteName: "DomiCita",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "DomiCita - Chatbot de WhatsApp para barberías y salones en RD"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "DomiCita - Tu WhatsApp se convierte en tu recepcionista 24/7",
    description: "El chatbot que agenda citas por WhatsApp mientras tú trabajas. Entiende jerga dominicana. 14 días gratis sin tarjeta.",
    images: ["/twitter-image.jpg"],
    creator: "@domicitard",
  },
  alternates: {
    canonical: "https://domicitas.do",
  },
  metadataBase: new URL("https://domicitas.do"),
  icons: {
    icon: [
      { url: '/logo-icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/logo-icon.svg',
  },
  verification: {
    google: "your-google-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light" style={{ colorScheme: 'light' }} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-white text-charcoal`}
      >
        {children}
      </body>
    </html>
  );
}
