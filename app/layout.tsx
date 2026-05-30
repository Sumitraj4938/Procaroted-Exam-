import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'AI Proctored Exam System',
  description: 'Secure online exam platform with real-time AI proctoring, face detection, and cheating prevention.',
  authors: [{ name: 'Shivam Raj' }],
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
