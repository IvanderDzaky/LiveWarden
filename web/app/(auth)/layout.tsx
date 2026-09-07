import { PublicGate } from '../../components/auth/auth-gates';

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PublicGate>{children}</PublicGate>;
}
