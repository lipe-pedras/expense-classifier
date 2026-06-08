import { forwardRef } from 'react';
import TextField, { type TextFieldProps } from '@mui/material/TextField';

type SelectProps = Omit<TextFieldProps, 'error' | 'variant' | 'select'> & {
  error?: string;
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, placeholder, children, ...rest }, ref) => (
    <TextField
      select
      SelectProps={{ native: true }}
      inputRef={ref}
      label={label}
      variant="outlined"
      size="small"
      error={Boolean(error)}
      helperText={error ?? helperText}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </TextField>
  ),
);

Select.displayName = 'Select';
