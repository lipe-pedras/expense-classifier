import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import MuiButton from '@mui/material/Button';
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

function DeleteAccountForm() {
  const { user, logout } = useAuthStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const currentUsername = user?.username ?? '';

  const [password, setPassword] = useState('');
  const [usernameConfirm, setUsernameConfirm] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Real field validation: password required, and the typed username must
  // exactly match the account's username before deletion is allowed.
  const usernameMatches = usernameConfirm === currentUsername;
  const usernameError =
    usernameConfirm.length > 0 && !usernameMatches
      ? `Type "${currentUsername}" exactly to confirm.`
      : undefined;
  const canSubmit = password.length > 0 && usernameMatches;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await usersApi.deleteAccount({ password, username: usernameConfirm });
      setConfirmOpen(false);
      logout();
      addToast('success', 'Your account has been deleted.');
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setConfirmOpen(false);
      setError(
        status === 401
          ? 'Password is incorrect.'
          : status === 400
            ? 'Username confirmation does not match.'
            : 'Could not delete the account.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
      </CardHeader>
      <CardContent>
        <Stack component="form" spacing={2} onSubmit={handleSubmit}>
          <Alert severity="warning">
            This permanently deletes your account and all documents, expenses and categories.
            This action cannot be undone.
          </Alert>
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            fullWidth
          />
          <Input
            label={`Type your username (${currentUsername}) to confirm`}
            value={usernameConfirm}
            onChange={(e) => setUsernameConfirm(e.target.value)}
            error={usernameError}
            required
            fullWidth
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Box>
            <Button type="submit" variant="danger" disabled={!canSubmit}>
              Delete my account
            </Button>
          </Box>
        </Stack>
      </CardContent>

      <Dialog open={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)}>
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you absolutely sure? This will permanently remove your account and every
            document, expense and category associated with it. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setConfirmOpen(false)} disabled={deleting}>
            Cancel
          </MuiButton>
          <MuiButton onClick={handleConfirmDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting…' : 'Yes, delete everything'}
          </MuiButton>
        </DialogActions>
      </Dialog>
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
        <DeleteAccountForm />
      </Box>
    </AppLayout>
  );
}
