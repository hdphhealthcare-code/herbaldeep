import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'Fusse CRM',
  description: 'Healthcare Order, Courier, Invoice & HR Management CRM',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-right" toastOptions={{ className: 'text-sm' }} />
        </AuthProvider>
      </body>
    </html>
  );
}
