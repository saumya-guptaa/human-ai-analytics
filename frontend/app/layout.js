export const metadata = {
  title: "Learning Analytics Dashboard",
  description: "NL-to-SQL analytics for the Open University Learning Analytics Dataset",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
