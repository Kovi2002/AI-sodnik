import localFont from "next/font/local";

export const sans = localFont({
  src: [
    { path: "../assets/fonts/IBMPlexSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/IBMPlexSans-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const serif = localFont({
  src: "../assets/fonts/IBMPlexSerif-Medium.woff2",
  weight: "500",
  variable: "--font-serif",
  display: "swap",
});

export const mono = localFont({
  src: "../assets/fonts/IBMPlexMono-Regular.woff2",
  weight: "400",
  variable: "--font-mono",
  display: "swap",
});
