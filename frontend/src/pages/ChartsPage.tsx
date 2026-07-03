import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { chartsApi } from '@/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { QueryChart } from '@/components/charts/QueryChart';
import type { ChartResult } from '@/types';

const EXAMPLES = [
  'Total spending by category',
  'Rent per month over the last 6 months as a line',
  'Top 5 vendors by total spent',
  'Monthly spending on utilities excluding insurance',
];

function extractError(err: unknown): string {
  const res = (err as { response?: { status?: number; data?: { error?: { message?: string } } } })
    ?.response;
  if (res?.data?.error?.message) return res.data.error.message;
  if (res?.status === 503) return 'The model took too long. Please try again.';
  return 'Something went wrong generating that chart.';
}

export function ChartsPage() {
  const [prompt, setPrompt] = useState('');
  const [submitted, setSubmitted] = useState('');

  const mutation = useMutation<ChartResult, unknown, string>({
    mutationFn: (p: string) => chartsApi.query(p),
  });

  const runQuery = (p: string) => {
    const trimmed = p.trim();
    if (!trimmed || mutation.isPending) return;
    setSubmitted(trimmed);
    mutation.mutate(trimmed);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runQuery(prompt);
  };

  return (
    <AppLayout>
      <Box sx={{ maxWidth: 820, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Ask your data
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Describe a chart in plain language — including specific categories, vendors, or filters.
            The model only writes the query; your data never leaves the server.
          </Typography>
        </Box>

        <Card>
          <CardContent>
            <Stack component="form" spacing={2} onSubmit={handleSubmit}>
              <Input
                label="What would you like to see?"
                placeholder="e.g. total spending by category last 3 months as a pie"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                fullWidth
                multiline
                maxRows={3}
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {EXAMPLES.map((ex) => (
                  <Chip
                    key={ex}
                    label={ex}
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setPrompt(ex);
                      runQuery(ex);
                    }}
                  />
                ))}
              </Box>
              <Box>
                <Button type="submit" loading={mutation.isPending} disabled={prompt.trim().length === 0}>
                  Generate chart
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {mutation.isPending && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center', py: 4 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Asking the model…
            </Typography>
          </Box>
        )}

        {mutation.isError && <Alert severity="warning">{extractError(mutation.error)}</Alert>}

        {mutation.isSuccess && mutation.data && (
          <Card>
            <CardHeader>
              <CardTitle>{submitted}</CardTitle>
            </CardHeader>
            <CardContent>
              <QueryChart result={mutation.data} />
            </CardContent>
          </Card>
        )}
      </Box>
    </AppLayout>
  );
}
