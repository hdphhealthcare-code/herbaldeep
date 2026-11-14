import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: { default: 'Herbal Deep', template: '%s | Herbal Deep' },
  description: 'Herbal Deep: orders, courier shipping, invoices and HR',
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
