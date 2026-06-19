import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "leaflet/dist/leaflet.css";
import "./globals.css";

import { TrainingProvider } from "@/app/context/TrainingContext";
import TrainingBanner from "@/app/components/training/TrainingBanner";

import { GenerateProvider } from "@/app/context/GenerateContext";
import GenerateBanner from "@/app/components/training/GenerateBanner";

import { Toaster } from "react-hot-toast";
import { StorageProvider } from "@/app/context/StorageContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Ventara",
  description: "Forecasting & Prediction Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`
          ${inter.variable}
          font-sans
          antialiased
          min-h-screen
          bg-gray-50
          text-gray-900
        `}
      >
        {/* TOASTER */}
        <Toaster position="bottom-right" />

        <TrainingProvider>
          <GenerateProvider>
            <StorageProvider>
              {children}
            </StorageProvider>
            <TrainingBanner />
            <GenerateBanner />
          </GenerateProvider>
        </TrainingProvider>
      </body>
    </html>
  );
}
