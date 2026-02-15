import { createContext, useContext } from "react";

export interface FormContextValue {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  dirty: boolean;
  setValue: (name: string, value: any) => void;
  setError: (name: string, error: string) => void;
  setTouched: (name: string) => void;
  validate: () => boolean;
  submit: () => void;
}

export const FormContext = createContext<FormContextValue>({
  values: {},
  errors: {},
  touched: {},
  dirty: false,
  setValue: () => {},
  setError: () => {},
  setTouched: () => {},
  validate: () => true,
  submit: () => {},
});

export function useFormContext(): FormContextValue {
  return useContext(FormContext);
}