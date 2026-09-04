import "./globals.css";

export const metadata = {
  title: "Cutting Room Dashboard",
  description: "Live production tracker",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
