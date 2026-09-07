import { AppShell } from '../../components/shell/app-shell';
import { ProtectedGate } from '../../components/auth/auth-gates';

export default function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ProtectedGate><AppShell>{children}</AppShell></ProtectedGate>;
}
