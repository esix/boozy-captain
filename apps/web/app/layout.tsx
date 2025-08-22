import '../styles/global.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
    <head>
      <link rel="stylesheet" href="/styles/global.css" precedence="default"/>
    </head>
    <body>
      {children}
    </body>
    </html>);
}
