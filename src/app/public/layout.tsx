import { ThemeProvider } from "@/context/ThemeContext";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
