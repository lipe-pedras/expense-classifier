import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { usersApi } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

function ProfileForm() {
  const { user, updateUser } = useAuthStore();
  const { addToast } = useToastStore();
  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const updated = await usersApi.update({ username, email });
      updateUser(updated);
      addToast('success', 'Profile updated.');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 409 ? 'Email or username already taken.' : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <Stack component="form" spacing={2} onSubmit={handleSubmit}>
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            fullWidth
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Box>
            <Button type="submit" loading={saving}>
              Save profile
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const { addToast } = useToastStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await usersApi.changePassword({ currentPassword, newPassword });
      addToast('success', 'Password changed.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 401 ? 'Current password is incorrect.' : 'Could not change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <Stack component="form" spacing={2} onSubmit={handleSubmit}>
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            fullWidth
          />
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            fullWidth
            slotProps={{ htmlInput: { minLength: 8 } }}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Box>
            <Button type="submit" loading={saving}>
              Change password
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ProfilePage() {
  return (
    <AppLayout>
      <Box sx={{ maxWidth: 520, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Account settings
        </Typography>
        <ProfileForm />
        <PasswordForm />
      </Box>
    </AppLayout>
  );
}
