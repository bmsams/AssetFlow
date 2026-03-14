import { createContext, useContext } from "react";

export interface FormContextValue {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  dirty: boolean;
  isSubmitting: boolean;
  setValue: (name: string, value: any) => void;
  setError: (name: string, error: string) => void;
  setTouched: (name: string) => void;
  registerDependency: (name: string, dependsOn?: string) => () => void;
  validate: () => boolean;
  submit: () => Promise<void>;
}

export const FormContext = createContext<FormContextValue>({
  values: {},
  errors: {},
  touched: {},
  dirty: false,
  isSubmitting: false,
  setValue: () => {},
  setError: () => {},
  setTouched: () => {},
  registerDependency: () => () => {},
  validate: () => true,
  submit: async () => {},
});

export function useFormContext(): FormContextValue {
  return useContext(FormContext);
}
