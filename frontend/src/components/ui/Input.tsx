import { forwardRef } from 'react';
import TextField, { type TextFieldProps } from '@mui/material/TextField';

type InputProps = Omit<TextFieldProps, 'error' | 'variant'> & {
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, ...rest }, ref) => (
    <TextField
      inputRef={ref}
      label={label}
      variant="outlined"
      size="small"
      error={Boolean(error)}
      helperText={error ?? helperText}
      {...rest}
    />
  ),
);

Input.displayName = 'Input';
